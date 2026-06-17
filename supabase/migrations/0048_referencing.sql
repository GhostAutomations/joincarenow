-- ============================================================
-- JOIN CARE NOW — Migration 0048: Referencing app
-- Applicants add their referees; the system emails each referee a secure,
-- no-login link to a reference form; completed references are tracked and
-- approved by staff. A default care reference form is seeded per company
-- (purpose = 'reference') and is editable in the Forms app.
-- Run AFTER 0047_my_onboarding_recent_first.sql.
-- ============================================================

-- ---------- Table: reference_requests ------------------------
-- ("references" is a SQL reserved word, so the table is named reference_requests)
create table if not exists public.reference_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  referee_name text not null,
  referee_email text not null,
  referee_employer text,
  referee_phone text,
  relationship text,
  token uuid not null default gen_random_uuid(),
  form_id uuid references public.forms (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'received', 'approved', 'rejected')),
  answers jsonb not null default '{}'::jsonb,
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  received_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_reference_requests_token on public.reference_requests (token);
create index if not exists idx_reference_requests_company on public.reference_requests (company_id);
create index if not exists idx_reference_requests_application on public.reference_requests (application_id);
create index if not exists idx_reference_requests_applicant on public.reference_requests (applicant_id);

create trigger trg_reference_requests_updated before update on public.reference_requests
  for each row execute function public.set_updated_at();

alter table public.reference_requests enable row level security;

-- Company staff manage; applicant sees/manages their own (only while pending).
create policy refreq_select_company on public.reference_requests
  for select using (public.is_company_member(company_id));
create policy refreq_insert_company on public.reference_requests
  for insert with check (public.is_company_member(company_id));
create policy refreq_update_company on public.reference_requests
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy refreq_delete_company on public.reference_requests
  for delete using (public.is_company_member(company_id));
create policy refreq_select_applicant on public.reference_requests
  for select using (public.is_applicant_owner(applicant_id));

-- ---------- Seed: default care reference form per company ----
create or replace function public.ensure_reference_form(p_company_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_form_id uuid;
begin
  select id into v_form_id
  from public.forms
  where company_id = p_company_id and purpose = 'reference'
  order by created_at
  limit 1;
  if v_form_id is not null then return v_form_id; end if;

  insert into public.forms (company_id, name, purpose)
  values (p_company_id, 'Employment reference', 'reference')
  returning id into v_form_id;

  insert into public.form_fields (form_id, label, field_type, required, options, position)
  values
    (v_form_id, 'In what capacity do you know the applicant?', 'short_text', true, '[]'::jsonb, 1),
    (v_form_id, 'What were the dates of their employment (from – to)?', 'short_text', true, '[]'::jsonb, 2),
    (v_form_id, 'What was their job title / role?', 'short_text', true, '[]'::jsonb, 3),
    (v_form_id, 'How would you rate their reliability and punctuality?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 4),
    (v_form_id, 'How would you rate their care and compassion?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 5),
    (v_form_id, 'Were there any safeguarding or disciplinary concerns?', 'yes_no', true, '[]'::jsonb, 6),
    (v_form_id, 'If yes, please provide details', 'long_text', false, '[]'::jsonb, 7),
    (v_form_id, 'Would you re-employ this person?', 'yes_no', true, '[]'::jsonb, 8),
    (v_form_id, 'Any additional comments', 'long_text', false, '[]'::jsonb, 9);

  return v_form_id;
end;
$$;

-- ---------- Applicant: my referees ---------------------------
create or replace function public.get_my_references()
returns table (
  id uuid, application_id uuid, job_title text, company_name text,
  referee_name text, referee_email text, referee_employer text,
  relationship text, status text
)
language sql security definer stable set search_path = public
as $$
  select rr.id, rr.application_id, j.title, c.name,
         rr.referee_name, rr.referee_email, rr.referee_employer,
         rr.relationship, rr.status
  from public.reference_requests rr
  join public.applicants ap on ap.id = rr.applicant_id
  join public.companies c on c.id = rr.company_id
  left join public.applications a on a.id = rr.application_id
  left join public.jobs j on j.id = a.job_id
  where ap.user_id = auth.uid()
  order by rr.created_at desc;
$$;

create or replace function public.add_my_referee(
  p_application_id uuid,
  p_name text,
  p_email text,
  p_employer text default null,
  p_relationship text default null,
  p_phone text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_form_id uuid;
  v_id uuid;
begin
  select a.company_id, a.applicant_id
    into v_company_id, v_applicant_id
  from public.applications a
  join public.applicants ap on ap.id = a.applicant_id
  where a.id = p_application_id and ap.user_id = auth.uid();
  if v_company_id is null then raise exception 'Not allowed'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Referee name and email are required';
  end if;

  v_form_id := public.ensure_reference_form(v_company_id);

  insert into public.reference_requests
    (company_id, application_id, applicant_id, referee_name, referee_email,
     referee_employer, referee_phone, relationship, form_id, status)
  values
    (v_company_id, p_application_id, v_applicant_id, trim(p_name), trim(p_email),
     p_employer, p_phone, p_relationship, v_form_id, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.delete_my_referee(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.reference_requests rr
  using public.applicants ap
  where rr.id = p_id
    and ap.id = rr.applicant_id
    and ap.user_id = auth.uid()
    and rr.status = 'pending';  -- can only remove before it's sent
end;
$$;

-- ---------- Public (referee, no login): by token -------------
create or replace function public.get_reference_by_token(p_token uuid)
returns table (
  reference_id uuid, status text, company_name text, job_title text,
  applicant_name text, referee_name text, referee_employer text
)
language sql security definer stable set search_path = public
as $$
  select rr.id, rr.status, c.name, j.title,
         nullif(trim(coalesce(ap.first_name,'') || ' ' || coalesce(ap.last_name,'')), ''),
         rr.referee_name, rr.referee_employer
  from public.reference_requests rr
  join public.companies c on c.id = rr.company_id
  left join public.applications a on a.id = rr.application_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = rr.applicant_id
  where rr.token = p_token;
$$;

create or replace function public.get_reference_form_by_token(p_token uuid)
returns table (
  field_id uuid, label text, field_type public.form_field_type, required boolean,
  options jsonb, help_text text, config jsonb, parent_field_id uuid, parent_value text, field_position int
)
language sql security definer stable set search_path = public
as $$
  select ff.id, ff.label, ff.field_type, ff.required, ff.options, ff.help_text, ff.config,
         ff.parent_field_id, ff.parent_value, ff.position
  from public.reference_requests rr
  join public.form_fields ff on ff.form_id = rr.form_id
  where rr.token = p_token
  order by ff.position, ff.created_at;
$$;

create or replace function public.submit_reference_by_token(p_token uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_company_id uuid;
  v_status text;
begin
  select id, company_id, status into v_id, v_company_id, v_status
  from public.reference_requests where token = p_token;
  if v_id is null then raise exception 'Reference not found'; end if;
  if v_status = 'approved' then raise exception 'This reference has already been completed'; end if;

  update public.reference_requests
  set answers = coalesce(p_answers, '{}'::jsonb),
      status = 'received',
      received_at = now(),
      review_note = null
  where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'reference.received', 'reference', v_id,
          jsonb_build_object('via', 'token'));
end;
$$;

grant execute on function public.get_reference_by_token(uuid) to anon, authenticated;
grant execute on function public.get_reference_form_by_token(uuid) to anon, authenticated;
grant execute on function public.submit_reference_by_token(uuid, jsonb) to anon, authenticated;
