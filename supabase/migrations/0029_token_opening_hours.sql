-- ============================================================
-- JOIN CARE NOW — Migration 0029: opening hours on the token page
-- The one-tap interview page needs the company's opening hours so the
-- applicant can only propose times when the office is open.
-- Run AFTER 0028_confirm_interview_time.sql.
-- ============================================================

drop function if exists public.get_interview_by_token(uuid);

create or replace function public.get_interview_by_token(p_token uuid)
returns table (
  interview_id uuid,
  scheduled_at timestamptz,
  duration_minutes int,
  mode text,
  location text,
  status public.interview_status,
  responded_at timestamptz,
  company_name text,
  job_title text,
  first_name text,
  opening_hours jsonb
)
language sql security definer stable set search_path = public
as $$
  select i.id, i.scheduled_at, i.duration_minutes, i.mode, i.location, i.status,
         i.responded_at, c.name, j.title, ap.first_name,
         coalesce(c.settings -> 'opening_hours', '{}'::jsonb)
  from public.interviews i
  join public.applications a on a.id = i.application_id
  join public.companies c on c.id = i.company_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = a.applicant_id
  where i.respond_token = p_token;
$$;
