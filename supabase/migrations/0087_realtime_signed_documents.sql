-- ============================================================
-- JOIN CARE NOW — Migration 0087: realtime for signed documents
-- So the staff "Sign Off" widget/screen and the applicant "Please re-sign"
-- section update live when a document is signed, signed off, rejected or
-- re-signed. RLS still applies. Run AFTER 0086_applicant_resign.sql.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'signed_documents'
  ) then
    execute 'alter publication supabase_realtime add table public.signed_documents';
  end if;
end $$;
