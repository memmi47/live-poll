-- Add voter_id column to responses for per-device deduplication.
-- The unique index allows one (choice) and one (open) response per voter per poll,
-- supporting "both" type polls while blocking exact duplicates.
alter table responses add column if not exists voter_id text;

create unique index if not exists responses_poll_voter_kind_uniq
  on responses (poll_id, voter_id, kind)
  where voter_id is not null;
