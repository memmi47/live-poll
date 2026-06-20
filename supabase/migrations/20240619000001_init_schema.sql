-- Enable pgvector for 384-dim embeddings (Supabase built-in gte-small)
create extension if not exists vector;

-- ── polls ────────────────────────────────────────────────────────────────────

create table polls (
  id            uuid      primary key default gen_random_uuid(),
  pin           text      unique not null,
  title         text      not null,
  question_type text      not null check (question_type in ('choice', 'open', 'both')),
  options       jsonb     default '[]'::jsonb,
  created_at    timestamptz default now()
);

-- ── clusters ─────────────────────────────────────────────────────────────────

create table clusters (
  id           uuid      primary key default gen_random_uuid(),
  poll_id      uuid      references polls(id) on delete cascade,
  centroid     vector(384),
  label        text,
  summary      text,
  member_count int       default 0,
  is_dirty     boolean   default true,
  updated_at   timestamptz default now()
);

-- NOTE: nearest-cluster matching is done in the Edge Function (JS cosine over
-- the poll's clusters), so we deliberately do NOT add an ivfflat index here —
-- it would never be used and an untrained ivfflat index can hurt recall.
-- If clustering ever moves into SQL (e.g. an RPC using `centroid <=> query`),
-- add `using ivfflat (centroid vector_cosine_ops) with (lists = N)` then.

-- ── responses ────────────────────────────────────────────────────────────────

create table responses (
  id           uuid      primary key default gen_random_uuid(),
  poll_id      uuid      references polls(id) on delete cascade,
  kind         text      not null check (kind in ('choice', 'open')),
  choice_value text,
  text         text,
  embedding    vector(384),
  cluster_id   uuid      references clusters(id),
  created_at   timestamptz default now()
);

-- Fast look-up of all responses that belong to a cluster (used by label-cluster)
create index responses_cluster_id_idx on responses (cluster_id);
create index responses_poll_id_idx    on responses (poll_id);
