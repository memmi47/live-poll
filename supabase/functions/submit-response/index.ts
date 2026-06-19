/**
 * Fast path: embed → cluster-assign (no AI) → return immediately.
 * Slow path: fire-and-forget call to label-cluster when member_count is a power of 2.
 */

import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

// Adjust this threshold to tune cluster granularity (lower → fewer, coarser clusters)
const SIMILARITY_THRESHOLD = 0.78;

// ── Supabase built-in AI type (gte-small, 384-dim) ──────────────────────────
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(
        input: string,
        options?: { mean_pool?: boolean; normalize?: boolean },
      ): Promise<{ data: Float32Array } | Float32Array>;
    };
  };
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const session = new Supabase.ai.Session('gte-small');
  const raw = await session.run(text, { mean_pool: true, normalize: true });
  // Handle both { data: Float32Array } and plain Float32Array
  const arr = (raw as { data?: Float32Array }).data ?? (raw as Float32Array);
  return Array.from(arr);
}

/** pgvector returns centroid as a string "[n1,n2,...]" via REST; handle both formats. */
function parseVector(v: string | number[]): number[] {
  if (Array.isArray(v)) return v;
  return JSON.parse(v as string) as number[];
}

/**
 * Format a number array as the text representation pgvector expects.
 * PostgREST passes JSON strings through PostgreSQL's text→vector implicit cast,
 * which is more reliable than passing a raw JSON array.
 */
function formatVector(v: number[]): string {
  return `[${v.join(',')}]`;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Weighted average of existing centroid and the new embedding. */
function updateCentroid(centroid: number[], embedding: number[], count: number): number[] {
  const next = count + 1;
  return centroid.map((v, i) => (v * count + embedding[i]) / next);
}

function isPowerOfTwo(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

// ── main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const body = await req.json();
    const { poll_id, kind, choice_value, text } = body as {
      poll_id: string;
      kind: string;
      choice_value?: string;
      text?: string;
    };

    if (!poll_id || !kind) {
      return jsonResponse({ error: 'poll_id and kind are required' }, 400);
    }

    const supabase = getServiceClient();

    // ── Objective (choice) ───────────────────────────────────────────────────
    if (kind === 'choice') {
      const { data, error } = await supabase
        .from('responses')
        .insert({ poll_id, kind, choice_value })
        .select()
        .single();
      if (error) throw error;
      return jsonResponse({ response: data }, 201);
    }

    // ── Subjective (open) – clustering pipeline ──────────────────────────────
    if (kind === 'open') {
      if (!text) return jsonResponse({ error: 'text is required for kind=open' }, 400);

      // 1. Generate embedding (gte-small, 384 dims, L2-normalised)
      const embedding = await generateEmbedding(text);

      // 2. Load all existing clusters for this poll
      const { data: clusters, error: clErr } = await supabase
        .from('clusters')
        .select('id, centroid, member_count')
        .eq('poll_id', poll_id);
      if (clErr) throw clErr;

      // 3. Find the closest cluster by cosine similarity
      let bestId: string | null = null;
      let bestSim = -Infinity;
      let bestCentroid: number[] = [];
      let bestCount = 0;

      for (const cl of clusters ?? []) {
        if (!cl.centroid) continue;
        const centroid = parseVector(cl.centroid);
        const sim = cosineSimilarity(centroid, embedding);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = cl.id;
          bestCentroid = centroid;
          bestCount = cl.member_count;
        }
      }

      let cluster_id: string;
      let newMemberCount: number;

      if (bestId && bestSim >= SIMILARITY_THRESHOLD) {
        // 4a. Assign to existing cluster; update weighted centroid
        newMemberCount = bestCount + 1;
        const newCentroid = updateCentroid(bestCentroid, embedding, bestCount);

        const { error: upErr } = await supabase
          .from('clusters')
          .update({
            centroid: formatVector(newCentroid),
            member_count: newMemberCount,
            is_dirty: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bestId);
        if (upErr) throw upErr;

        cluster_id = bestId;
      } else {
        // 4b. No close match – create a new cluster
        newMemberCount = 1;
        const { data: newCl, error: insErr } = await supabase
          .from('clusters')
          .insert({
            poll_id,
            centroid: formatVector(embedding),
            member_count: 1,
            is_dirty: true,
          })
          .select()
          .single();
        if (insErr) throw insErr;

        cluster_id = newCl.id;
      }

      // 5. Persist the response
      const { data: response, error: respErr } = await supabase
        .from('responses')
        .insert({ poll_id, kind, text, embedding: formatVector(embedding), cluster_id })
        .select()
        .single();
      if (respErr) throw respErr;

      // 6. Slow path: trigger label generation when member_count is a power of 2
      //    (1, 2, 4, 8, 16, 32 …) – fire-and-forget so we return immediately.
      if (isPowerOfTwo(newMemberCount)) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        fetch(`${supabaseUrl}/functions/v1/label-cluster`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ cluster_id }),
        }).catch((e) => console.error('label-cluster trigger failed:', e));
      }

      return jsonResponse({ response }, 201);
    }

    return jsonResponse({ error: "kind must be 'choice' or 'open'" }, 400);
  } catch (err) {
    console.error('submit-response error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
