-- ============================================================
-- JOIN CARE NOW — Migration 0026: One-tap interview links
-- Each interview gets a secret token so the applicant can confirm,
-- change, or decline from a link in their SMS/email — no login.
-- Run AFTER 0025_notifications.sql.
-- ============================================================

alter table public.interviews
  add column if not exists respond_token uuid not null default gen_random_uuid();
create unique index if not exists idx_interviews_token on public.interviews (respond_token);

-- ---------- Public: fetch interview by token -----------------
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
  first_name text
)
language sql security definer stable set search_path = public
as $$
  select i.id, i.scheduled_at, i.duration_minutes, i.mode, i.location, i.status,
         i.responded_at, c.name, j.title, ap.first_name
  from public.interviews i
  join public.applications a on a.id = i.application_id
  join public.companies c on c.id = i.company_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = a.applicant_id
  where i.respond_token = p_token;
$$;

-- ---------- Public: respond by token -------------------------
create or replace function public.respond_to_interview_by_token(
  p_token uuid,
  p_response text,
  p_requested_time text default null,
  p_note text default null
)
returns table (company_id uuid, application_id uuid, applicant_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_company_id uuid;
  v_application_id uuid;
  v_name text;
begin
  if p_response not in ('confirmed', 'reschedule_requested', 'declined') then
    raise exception 'Invalid response';
  end if;

  select i.id, i.company_id, i.application_id
    into v_id, v_company_id, v_application_id
  from public.interviews i where i.respond_token = p_token;
  if v_id is null then raise exception 'Interview not found'; end if;

  update public.interviews
  set status = p_response::public.interview_status,
      requested_time = case when p_response = 'reschedule_requested' then p_requested_time else null end,
      applicant_note = p_note,
      responded_at = now()
  where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'interview.responded', 'interview', v_id,
          jsonb_build_object('response', p_response, 'via', 'token'));

  select trim(coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, ''))
    into v_name
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  where a.id = v_application_id;

  return query select v_company_id, v_application_id, nullif(v_name, '');
end;
$$;
