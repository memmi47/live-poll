-- Multi-question support + vector cast bug fix.
-- Run this in Supabase SQL Editor (once).

-- ── Schema additions ─────────────────────────────────────────────────────────
alter table polls     add column if not exists questions     jsonb   default '[]'::jsonb;
alter table responses add column if not exists question_idx  integer default 0;
alter table clusters  add column if not exists question_idx  integer default 0;

-- ── Voter deduplication index: add question_idx ───────────────────────────────
-- Prior index (migration 000004) lacked question_idx, which blocked a voter
-- from answering Q1 and Q2 of the same poll (same poll_id + voter_id + kind).
drop   index if exists responses_poll_voter_kind_uniq;
create unique index  if not exists responses_poll_voter_kind_q_uniq
  on responses (poll_id, voter_id, kind, question_idx)
  where voter_id is not null;

-- ── Fix assign_or_create_cluster ─────────────────────────────────────────────
-- BUG: r_centroid::float8[] fails — pgvector only supports vector→float4[] cast.
--      Arithmetic is still done in float8 precision; result cast back to float4.
-- NEW: p_question_idx parameter so clusters are scoped per question.
create or replace function public.assign_or_create_cluster(
  p_poll_id      uuid,
  p_embedding    vector(384),
  p_threshold    float8  default 0.78,
  p_question_idx integer default 0
)
returns table(cluster_id uuid, new_member_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r_id       uuid;
  r_sim      float8;
  r_count    int;
  r_centroid vector(384);
begin
  select  c.id,
          1.0 - (c.centroid <=> p_embedding),
          c.member_count,
          c.centroid
  into    r_id, r_sim, r_count, r_centroid
  from    clusters c
  where   c.poll_id      = p_poll_id
    and   c.question_idx = p_question_idx
    and   c.centroid     is not null
  order by c.centroid <=> p_embedding
  limit 1
  for update;

  if found and r_sim >= p_threshold then
    update clusters
    set
      centroid = (
        select array_agg(((a::float8 * r_count + b::float8) / (r_count + 1)::float8)::float4)::vector
        from   unnest(r_centroid::float4[], p_embedding::float4[]) as t(a, b)
      ),
      member_count = r_count + 1,
      is_dirty     = true,
      updated_at   = now()
    where id = r_id;

    cluster_id       := r_id;
    new_member_count := r_count + 1;
  else
    insert into clusters (poll_id, question_idx, centroid, member_count, is_dirty)
    values (p_poll_id, p_question_idx, p_embedding, 1, true)
    returning id, member_count
    into r_id, r_count;

    cluster_id       := r_id;
    new_member_count := 1;
  end if;

  return next;
end;
$$;

comment on function public.assign_or_create_cluster is
  'Atomically find-or-create the best cluster for an embedding. '
  'Uses float4[] cast (pgvector-native) to avoid double-precision cast error. '
  'Supports multi-question polls via p_question_idx parameter.';
