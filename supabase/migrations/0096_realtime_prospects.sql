-- ============================================================
-- JOIN CARE NOW — Migration 0096: realtime for the Sales (CRM) pipeline
-- So the prospect board updates live when a stage changes (e.g. an inbound
-- email/SMS auto-moves a prospect) or a message lands. RLS still applies, so
-- only the founder receives these events. Adding tables to the publication
-- only emits to clients that subscribe — it does not affect push latency for
-- any other table/feature. Run AFTER 0095_platform_settings.sql.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prospect_companies'
  ) then
    execute 'alter publication supabase_realtime add table public.prospect_companies';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prospect_activities'
  ) then
    execute 'alter publication supabase_realtime add table public.prospect_activities';
  end if;
end $$;
