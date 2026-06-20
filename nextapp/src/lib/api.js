'use client';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isLive = Boolean(url && anon);

export const supabase = isLive ? createClient(url, anon) : null;

const fnHeaders = {
  'Content-Type': 'application/json',
  apikey: anon,
  Authorization: `Bearer ${anon}`,
};

async function callFn(name, body, init = {}) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: fnHeaders,
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${name} failed (${res.status})`);
  return json;
}

export function createPoll({ title, question_type, options }) {
  return callFn('create-poll', { title, question_type, options });
}

export function getPoll(pin) {
  return fetch(`${url}/functions/v1/get-poll?pin=${encodeURIComponent(pin)}`, {
    headers: fnHeaders,
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Poll not found');
    return json;
  });
}

export function submitResponse({ poll_id, kind, choice_value, text }) {
  return callFn('submit-response', { poll_id, kind, choice_value, text });
}

export async function fetchChoiceResponses(pollId) {
  const { data, error } = await supabase
    .from('responses')
    .select('choice_value')
    .eq('poll_id', pollId)
    .eq('kind', 'choice');
  if (error) throw error;
  return data ?? [];
}

export async function fetchClusters(pollId) {
  const { data, error } = await supabase
    .from('clusters')
    .select('id, label, summary, member_count')
    .eq('poll_id', pollId)
    .order('member_count', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function subscribeResponses(pollId, onInsert) {
  const channel = supabase
    .channel(`responses:${pollId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'responses', filter: `poll_id=eq.${pollId}` },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeClusters(pollId, onChange) {
  const channel = supabase
    .channel(`clusters:${pollId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'clusters', filter: `poll_id=eq.${pollId}` },
      () => onChange(),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
