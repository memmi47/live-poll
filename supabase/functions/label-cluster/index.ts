/**
 * Slow path: call OpenRouter to generate a Korean label + summary for a cluster.
 * Called fire-and-forget from submit-response when member_count reaches a power of 2.
 */

import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LABEL_MODEL = 'meta-llama/llama-3.1-8b-instruct';
const MAX_SAMPLES = 15;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown code-fence markers, then parse JSON. */
function safeParseJson(raw: string): { label: string; summary: string } | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'label' in parsed &&
      'summary' in parsed &&
      typeof (parsed as Record<string, unknown>).label === 'string' &&
      typeof (parsed as Record<string, unknown>).summary === 'string'
    ) {
      return parsed as { label: string; summary: string };
    }
  } catch {
    // fall through
  }
  return null;
}

// ── main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { cluster_id } = (await req.json()) as { cluster_id: string };
    if (!cluster_id) return jsonResponse({ error: 'cluster_id is required' }, 400);

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'OPENROUTER_API_KEY is not configured' }, 500);

    const supabase = getServiceClient();

    // Load up to MAX_SAMPLES texts from this cluster
    const { data: responses, error: fetchErr } = await supabase
      .from('responses')
      .select('text')
      .eq('cluster_id', cluster_id)
      .not('text', 'is', null)
      .limit(MAX_SAMPLES);

    if (fetchErr) throw fetchErr;
    if (!responses?.length) return jsonResponse({ error: 'No responses found for cluster' }, 404);

    const opinions = responses.map((r) => `- ${r.text}`).join('\n');

    const prompt =
      `다음은 한 그룹에 모인 사용자 의견들이다. 이 의견들을 가장 잘 대표하는 1~2단어 한국어 키워드 라벨과 한 문장 한국어 요약을 만들어라.\n` +
      `반드시 아래 JSON만 출력하고 그 밖의 어떤 텍스트도 출력하지 마라.\n` +
      `{"label": "키워드", "summary": "한 문장 요약"}\n\n` +
      `의견들:\n${opinions}`;

    const llmRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') ?? 'https://live-poll.app',
        'X-Title': 'Live Poll Clustering',
      },
      body: JSON.stringify({
        model: LABEL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      throw new Error(`OpenRouter ${llmRes.status}: ${errText}`);
    }

    const llmData = (await llmRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = llmData.choices?.[0]?.message?.content ?? '';

    const parsed = safeParseJson(rawContent);
    if (!parsed) {
      throw new Error(`Unexpected LLM output: ${rawContent}`);
    }

    // Persist label & summary; mark cluster clean
    const { error: updateErr } = await supabase
      .from('clusters')
      .update({
        label: parsed.label,
        summary: parsed.summary,
        is_dirty: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cluster_id);

    if (updateErr) throw updateErr;

    return jsonResponse({ cluster_id, label: parsed.label, summary: parsed.summary });
  } catch (err) {
    console.error('label-cluster error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
