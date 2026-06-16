-- ============================================================
-- JOIN CARE NOW — Migration 0027: Realtime for the pipeline
-- Add the pipeline-relevant tables to the supabase_realtime
-- publication so the board updates instantly via websocket push
-- (RLS still applies — clients only receive their own company's rows).
-- Run AFTER 0026_interview_token.sql.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['applications', 'interviews', 'messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
