-- ============================================================
-- JOIN CARE NOW — Migration 0126: Public application-form header meta
-- The public apply page can already read a job's form FIELDS
-- (get_application_form) but not the form's header (name/description/style), so
-- the styled header (logo + title + description, with alignment) couldn't show
-- to applicants. This read-only SECURITY DEFINER RPC exposes just that header
-- meta for a PUBLISHED job's application form. Run AFTER 0125_office_team.sql.
-- ============================================================

drop function if exists public.get_application_form_meta(uuid);

create or replace function public.get_application_form_meta(p_job_id uuid)
returns table (name text, description text, style jsonb)
language sql security definer stable set search_path = public
as $$
  select f.name, f.description, f.style
  from public.jobs j
  join public.forms f on f.id = j.application_form_id
  where j.id = p_job_id
    and j.status = 'published'
    and j.application_form_id is not null;
$$;

grant execute on function public.get_application_form_meta(uuid) to anon, authenticated;
