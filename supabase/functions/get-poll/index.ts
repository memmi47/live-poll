import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const pin = new URL(req.url).searchParams.get('pin');
    if (!pin) return jsonResponse({ error: 'pin query parameter is required' }, 400);

    const supabase = getServiceClient();

    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .select('*')
      .eq('pin', pin)
      .single();

    if (pollErr || !poll) return jsonResponse({ error: 'Poll not found' }, 404);

    const { data: clusters } = await supabase
      .from('clusters')
      .select('id, label, summary, member_count, is_dirty, updated_at')
      .eq('poll_id', poll.id)
      .order('member_count', { ascending: false });

    return jsonResponse({ poll, clusters: clusters ?? [] });
  } catch (err) {
    console.error('get-poll error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
