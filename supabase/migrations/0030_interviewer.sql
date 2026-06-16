-- ============================================================
-- JOIN CARE NOW — Migration 0030: Interviewer + shared schedule
-- Interviews are assigned to a staff member (interviewer). A company
-- function returns the whole company's interview schedule (with names)
-- for the Interviews page and slot conflict detection.
-- Run AFTER 0029_token_opening_hours.sql.
-- ============================================================

alter table public.interviews
  add column if not exists interviewer_id uuid references public.profiles (id) on delete set null;

-- Recreate schedule_interview to also store the interviewer.
drop function if exists public.schedule_interview(uuid, timestamptz, int, text, text, text);

create or replace function public.schedule_interview(
  p_application_id uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes int,
  p_mode text,
  p_location text,
  p_channel text,
  p_interviewer_id uuid default null
)
returns public.interviews
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_row public.interviews;
begin
  select company_id into v_company_id
  from public.applications where id = p_application_id;
  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;
  if p_channel not in ('sms', 'email', 'both') then raise exception 'Invalid contact method'; end if;

  insert into public.interviews
    (application_id, company_id, scheduled_at, duration_minutes, mode, location,
     channel, status, interviewer_id, created_by)
  values
    (p_application_id, v_company_id, p_scheduled_at, coalesce(p_duration_minutes, 30),
     p_mode, p_location, p_channel, 'proposed', p_interviewer_id, auth.uid())
  on conflict (application_id) do update
    set scheduled_at = excluded.scheduled_at,
        duration_minutes = excluded.duration_minutes,
        mode = excluded.mode,
        location = excluded.location,
        channel = excluded.channel,
        interviewer_id = excluded.interviewer_id,
        status = 'proposed',
        applicant_note = null,
        requested_time = null,
        responded_at = null
  returning * into v_row;

  update public.applications set stage = 'interview'
  where id = p_application_id and stage <> 'interview';

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'interview.scheduled', 'interview', v_row.id,
          jsonb_build_object('scheduled_at', p_scheduled_at, 'channel', p_channel));

  return v_row;
end;
$$;

-- Whole-company interview schedule with applicant + interviewer names.
create or replace function public.get_company_interviews()
returns table (
  interview_id uuid,
  application_id uuid,
  company_id uuid,
  scheduled_at timestamptz,
  duration_minutes int,
  mode text,
  location text,
  status public.interview_status,
  applicant_name text,
  interviewer_id uuid,
  interviewer_name text
)
language sql security definer stable set search_path = public
as $$
  select i.id, i.application_id, i.company_id, i.scheduled_at, i.duration_minutes,
         i.mode, i.location, i.status,
         nullif(trim(coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '')), ''),
         i.interviewer_id,
         coalesce(p.full_name, p.email)
  from public.interviews i
  join public.applications a on a.id = i.application_id
  left join public.applicants ap on ap.id = a.applicant_id
  left join public.profiles p on p.id = i.interviewer_id
  where public.is_company_member(i.company_id)
  order by i.scheduled_at;
$$;
