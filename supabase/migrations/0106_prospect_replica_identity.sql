-- Make the CRM pipeline update live on stage changes.
-- Supabase Realtime can deliver INSERTs on an RLS-protected table without extra
-- config, but to apply RLS to UPDATE/DELETE events it needs the full OLD row.
-- With the default replica identity (primary key only) the RLS check can't run,
-- so UPDATE events (e.g. a prospect moving to Won) are silently dropped and the
-- board only updates on a manual refresh. REPLICA IDENTITY FULL fixes that.
alter table public.prospect_companies replica identity full;
alter table public.prospect_activities replica identity full;
