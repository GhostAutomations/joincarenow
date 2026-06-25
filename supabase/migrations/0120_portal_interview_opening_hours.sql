-- ============================================================
-- JOIN CARE NOW — Migration 0120: opening hours in the portal interview feed
-- The applicant portal's "Request new time" must block out times outside the
-- company's opening hours, exactly like the emailed interview link does. The
-- applicant can't read companies.settings directly (RLS), so expose the
-- company's opening_hours via get_my_interviews (SECURITY DEFINER, own rows
-- only). Run AFTER 0119_google_jobs.sql.
-- ============================================================

drop function if exists public.get_my_interviews();
create or replace function public.get_my_interviews()
returns table (
  interview_id uuid,
  application_id uuid,
  scheduled_at timestamptz,
  duration_minutes int,
  mode text,
  location text,
  status public.interview_status,
  opening_hours jsonb
)
language sql security definer stable set search_path = public
as $$
  select i.id, i.application_id, i.scheduled_at, i.duration_minutes,
         i.mode, i.location, i.status,
         coalesce(c.settings -> 'opening_hours', '{}'::jsonb)
  from public.interviews i
  join public.applications a on a.id = i.application_id
  join public.applicants ap on ap.id = a.applicant_id
  join public.companies c on c.id = a.company_id
  where ap.user_id = auth.uid();
$$;
