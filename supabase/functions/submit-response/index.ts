/**
 * Fast path: embed → cluster-assign (no AI) → return immediately.
 * Slow path: fire-and-forget call to label-cluster when member_count is a power of 2.
 */

import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  findBestCluster,
  formatVector,
  isPowerOfTwo,
  SIMILARITY_THRESHOLD,
  updateCentroid,
} from '../_shared/clustering.ts';

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

async function generateEmbedding(text: string): Promise<number[]> {
  const session = new Supabase.ai.Session('gte-small');
  const raw = await session.run(text, { mean_pool: true, normalize: true });
  // Handle both { data: Float32Array } and plain Float32Array
  const arr = (raw as { data?: Float32Array }).data ?? (raw as Float32Array);
  return Array.from(arr);
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
      const best = findBestCluster(clusters ?? [], embedding);

      let cluster_id: string;
      let newMemberCount: number;

      if (best && best.similarity >= SIMILARITY_THRESHOLD) {
        // 4a. Assign to existing cluster; update weighted centroid
        newMemberCount = best.member_count + 1;
        const newCentroid = updateCentroid(best.centroid, embedding, best.member_count);

        const { error: upErr } = await supabase
          .from('clusters')
          .update({
            centroid: formatVector(newCentroid),
            member_count: newMemberCount,
            is_dirty: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', best.id);
        if (upErr) throw upErr;

        cluster_id = best.id;
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
