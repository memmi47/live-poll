-- Enable Supabase Realtime for the two tables the frontend subscribes to.
-- Run after the tables exist.

alter publication supabase_realtime add table responses;
alter publication supabase_realtime add table clusters;

-- REPLICA IDENTITY FULL makes the full row available on UPDATE/DELETE in the
-- WAL, so Realtime can reliably evaluate the `poll_id=eq.<id>` filter on every
-- event (the admin/stage views subscribe with that filter, and the clusters
-- channel listens to UPDATE events as centroids/labels change).
alter table responses replica identity full;
alter table clusters  replica identity full;
