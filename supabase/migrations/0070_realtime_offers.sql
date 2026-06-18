-- ============================================================
-- JOIN CARE NOW — Migration 0070: Realtime for offers
-- The pipeline board already subscribes to the offers table, but the table was
-- never added to the supabase_realtime publication, so offer status changes only
-- surfaced on the 60s poll fallback (acceptance took ~a minute to show). Add it so
-- accept/decline pushes instantly. (RLS still applies.)
-- Run AFTER 0069_fix_employee_ref_lock.sql.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers'
  ) then
    execute 'alter publication supabase_realtime add table public.offers';
  end if;
end $$;
