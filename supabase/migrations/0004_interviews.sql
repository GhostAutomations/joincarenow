-- ============================================================
-- JOIN CARE NOW — Migration 0004: Interview Scheduling
-- Pipeline stage action: schedule an interview, choose how to
-- invite (sms/email/both), and track the applicant's response.
-- Card colour follows status: proposed=blue, confirmed=green,
-- reschedule_requested=yellow, declined=red.
-- Actual SMS/email delivery is added in the Communication phase;
-- the channel choice is captured here and the applicant responds
-- from their portal in the meantime.
-- Run AFTER 0003_jobs_applicants_applications.sql.
-- ============================================================

create type public.interview_status as enum (
  'proposed', 'confirmed', 'reschedule_requested', 'declined'
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  mode text,                              -- 'in_person' | 'phone' | 'video'
  location text,                          -- address / phone number / meeting link
  channel text not null default 'email' check (channel in ('sms', 'email', 'both')),
  status public.interview_status not null default 'proposed',
  applicant_note text,                    -- reason on reschedule/decline
  requested_time text,                    -- applicant's proposed alternative (free text)
  responded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_interviews_company on public.interviews (company_id);
create index idx_interviews_application on public.interviews (application_id);

create trigger trg_interviews_updated before update on public.interviews
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------------------------------------------
alter table public.interviews enable row level security;

-- Company members can read their company's interviews (pipeline board).
create policy "interviews_select_company" on public.interviews
  for select using (public.is_company_member(company_id));

-- The applicant can read their own interview (portal). Writes for both
-- sides go through the SECURITY DEFINER RPCs below.
create policy "interviews_select_applicant" on public.interviews
  for select using (
    exists (
      select 1
      from public.applications a
      join public.applicants ap on ap.id = a.applicant_id
      where a.id = interviews.application_id
        and ap.user_id = auth.uid()
    )
  );

-- ---------- RPC: staff schedules / reschedules ---------------
create or replace function public.schedule_interview(
  p_application_id uuid,
  p_scheduled_at timestamptz,
  p_duration_minutes int,
  p_mode text,
  p_location text,
  p_channel text
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
  if v_company_id is null then
    raise exception 'Application not found';
  end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;
  if p_channel not in ('sms', 'email', 'both') then
    raise exception 'Invalid contact method';
  end if;

  insert into public.interviews
    (application_id, company_id, scheduled_at, duration_minutes, mode, location,
     channel, status, created_by)
  values
    (p_application_id, v_company_id, p_scheduled_at, coalesce(p_duration_minutes, 30),
     p_mode, p_location, p_channel, 'proposed', auth.uid())
  on conflict (application_id) do update
    set scheduled_at = excluded.scheduled_at,
        duration_minutes = excluded.duration_minutes,
        mode = excluded.mode,
        location = excluded.location,
        channel = excluded.channel,
        status = 'proposed',
        applicant_note = null,
        requested_time = null,
        responded_at = null
  returning * into v_row;

  -- Make sure the application is in the interview stage.
  update public.applications set stage = 'interview'
  where id = p_application_id and stage <> 'interview';

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'interview.scheduled', 'interview', v_row.id,
          jsonb_build_object('scheduled_at', p_scheduled_at, 'channel', p_channel));

  return v_row;
end;
$$;

-- ---------- RPC: applicant responds --------------------------
create or replace function public.respond_to_interview(
  p_interview_id uuid,
  p_response text,            -- 'confirmed' | 'reschedule_requested' | 'declined'
  p_requested_time text default null,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_owner boolean;
  v_company_id uuid;
begin
  if p_response not in ('confirmed', 'reschedule_requested', 'declined') then
    raise exception 'Invalid response';
  end if;

  select
    exists (
      select 1
      from public.interviews i
      join public.applications a on a.id = i.application_id
      join public.applicants ap on ap.id = a.applicant_id
      where i.id = p_interview_id and ap.user_id = auth.uid()
    ),
    (select company_id from public.interviews where id = p_interview_id)
  into v_owner, v_company_id;

  if not v_owner then
    raise exception 'Not allowed';
  end if;

  update public.interviews
  set status = p_response::public.interview_status,
      requested_time = case when p_response = 'reschedule_requested' then p_requested_time else null end,
      applicant_note = p_note,
      responded_at = now()
  where id = p_interview_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'interview.responded', 'interview', p_interview_id,
          jsonb_build_object('response', p_response));
end;
$$;

-- ---------- RPC: applicant's interviews (portal) -------------
create or replace function public.get_my_interviews()
returns table (
  interview_id uuid,
  application_id uuid,
  scheduled_at timestamptz,
  duration_minutes int,
  mode text,
  location text,
  status public.interview_status
)
language sql security definer stable set search_path = public
as $$
  select i.id, i.application_id, i.scheduled_at, i.duration_minutes,
         i.mode, i.location, i.status
  from public.interviews i
  join public.applications a on a.id = i.application_id
  join public.applicants ap on ap.id = a.applicant_id
  where ap.user_id = auth.uid();
$$;
