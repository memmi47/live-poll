-- Enable Supabase Realtime for the two tables the frontend subscribes to.
-- Run after the tables exist.

alter publication supabase_realtime add table responses;
alter publication supabase_realtime add table clusters;
