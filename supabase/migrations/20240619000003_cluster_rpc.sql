-- Atomic cluster assignment function.
--
-- Replaces the JS read-modify-write in submit-response with a single
-- Postgres transaction, eliminating the concurrent centroid-drift race.
--
-- Algorithm
-- 1. Lock the nearest cluster row for this poll (FOR UPDATE).
-- 2a. If cosine_similarity >= threshold → update centroid (running average)
--     and increment member_count — all within the same lock scope.
-- 2b. If no match → INSERT a new cluster.
-- 3. Return (cluster_id, new_member_count) for the caller.

-- Now that the RPC uses `centroid <=> p_embedding` (pgvector KNN operator),
-- an ivfflat approximate-nearest-neighbour index is actually used.
-- lists = 10 is appropriate until cluster count exceeds ~10 000 rows.
create index if not exists clusters_centroid_idx
  on clusters using ivfflat (centroid vector_cosine_ops)
  with (lists = 10);

create or replace function public.assign_or_create_cluster(
  p_poll_id    uuid,
  p_embedding  vector(384),
  p_threshold  float8 default 0.78
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
  -- Find the nearest cluster by cosine distance and lock that row.
  -- cosine_similarity = 1 - cosine_distance  (pgvector <=> is cosine distance).
  -- FOR UPDATE blocks any concurrent update to the same row until this
  -- transaction commits, preventing the read-then-write drift race.
  select  c.id,
          1.0 - (c.centroid <=> p_embedding),
          c.member_count,
          c.centroid
  into    r_id, r_sim, r_count, r_centroid
  from    clusters c
  where   c.poll_id = p_poll_id
    and   c.centroid is not null
  order by c.centroid <=> p_embedding
  limit 1
  for update;

  if found and r_sim >= p_threshold then
    -- Running centroid average: (old_centroid * count + new_embedding) / (count + 1)
    -- unnest zips the two 384-dim arrays element-by-element.
    update clusters
    set
      centroid = (
        select array_agg((a * r_count + b) / (r_count + 1)::float8)::vector
        from   unnest(r_centroid::float8[], p_embedding::float8[]) as t(a, b)
      ),
      member_count = r_count + 1,
      is_dirty     = true,
      updated_at   = now()
    where id = r_id;

    cluster_id       := r_id;
    new_member_count := r_count + 1;
  else
    -- No match (or table is empty for this poll) — create a new cluster.
    insert into clusters (poll_id, centroid, member_count, is_dirty)
    values (p_poll_id, p_embedding, 1, true)
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
  'Locks the matched row with FOR UPDATE to prevent concurrent centroid drift.';
