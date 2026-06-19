-- ============================================================
-- JOIN CARE NOW — Migration 0077: realtime for onboarding tasks
-- So the applicant portal updates live when a form / document request / task is
-- sent to them (onboarding_tasks), alongside offers/applications/interviews/
-- messages which are already in the publication. RLS still applies, so an
-- applicant only receives their own rows. Run AFTER 0076_signature_methods.sql.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'onboarding_tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.onboarding_tasks';
  end if;
end $$;
