/**
 * Fast path: embed → assign_or_create_cluster (RPC, atomic) → return immediately.
 * Slow path: fire-and-forget call to label-cluster when member_count is a power of 2.
 *
 * Concurrency note: cluster assignment runs inside a Postgres function that
 * locks the matched cluster row with FOR UPDATE, eliminating the
 * read-modify-write race that would exist if the JS code fetched clusters and
 * updated them in separate round-trips.
 */

import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  formatVector,
  isPowerOfTwo,
  SIMILARITY_THRESHOLD,
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
  const arr = (raw as { data?: Float32Array }).data ?? (raw as Float32Array);
  return Array.from(arr);
}

// ── main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const body = await req.json();
    const { poll_id, kind, choice_value, text, voter_id } = body as {
      poll_id: string;
      kind: string;
      choice_value?: string;
      text?: string;
      voter_id?: string;
    };

    if (!poll_id || !kind) {
      return jsonResponse({ error: 'poll_id and kind are required' }, 400);
    }

    const supabase = getServiceClient();

    // ── Objective (choice) ───────────────────────────────────────────────────
    if (kind === 'choice') {
      const { data, error } = await supabase
        .from('responses')
        .insert({ poll_id, kind, choice_value, ...(voter_id ? { voter_id } : {}) })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return jsonResponse({ error: 'already_voted' }, 409);
        throw error;
      }
      return jsonResponse({ response: data }, 201);
    }

    // ── Subjective (open) – atomic cluster assignment via RPC ────────────────
    if (kind === 'open') {
      if (!text) return jsonResponse({ error: 'text is required for kind=open' }, 400);

      // 1. Generate embedding (gte-small, 384 dims, L2-normalised)
      const embedding = await generateEmbedding(text);

      // 2. Atomically find or create cluster (Postgres-side FOR UPDATE lock)
      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        'assign_or_create_cluster',
        {
          p_poll_id:   poll_id,
          p_embedding: formatVector(embedding),
          p_threshold: SIMILARITY_THRESHOLD,
        },
      );
      if (rpcErr) throw rpcErr;

      const { cluster_id, new_member_count } = (
        rpcRows as Array<{ cluster_id: string; new_member_count: number }>
      )[0];

      // 3. Persist the response (embedding stored for potential future use)
      const { data: response, error: respErr } = await supabase
        .from('responses')
        .insert({ poll_id, kind, text, embedding: formatVector(embedding), cluster_id, ...(voter_id ? { voter_id } : {}) })
        .select()
        .single();
      if (respErr) {
        if (respErr.code === '23505') return jsonResponse({ error: 'already_voted' }, 409);
        throw respErr;
      }

      // 4. Slow path: trigger label generation at power-of-2 member counts
      //    (1, 2, 4, 8, 16 …). Fire-and-forget so we return immediately.
      if (isPowerOfTwo(new_member_count)) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
