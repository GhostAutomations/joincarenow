-- ============================================================
-- JOIN CARE NOW — Migration 0005: Form Builder engine
-- Generic forms (purpose = 'application' for now; 'offer' /
-- 'onboarding' reuse the same engine later). A form is assigned to
-- a job; its fields render on the apply page on top of the built-in
-- basics, and answers are stored as a submission per application.
-- Run AFTER 0004_interviews.sql.
-- ============================================================

create type public.form_field_type as enum (
  'short_text', 'long_text', 'number', 'date',
  'dropdown', 'radio', 'checkboxes', 'yes_no', 'file'
);

-- ---------- FORMS -------------------------------------------
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  purpose text not null default 'application',  -- application | offer | onboarding
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_forms_company on public.forms (company_id);

create trigger trg_forms_updated before update on public.forms
  for each row execute function public.set_updated_at();

-- ---------- FORM FIELDS -------------------------------------
create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  label text not null,
  field_type public.form_field_type not null,
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,   -- array of strings for choice types
  help_text text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_form_fields_form on public.form_fields (form_id, position);

-- ---------- JOB ↔ FORM --------------------------------------
alter table public.jobs
  add column application_form_id uuid references public.forms (id) on delete set null;

-- ---------- FORM SUBMISSIONS --------------------------------
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  form_id uuid not null references public.forms (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  applicant_id uuid references public.applicants (id) on delete set null,
  answers jsonb not null default '{}'::jsonb,    -- { field_id: value }
  created_at timestamptz not null default now(),
  unique (application_id, form_id)
);
create index idx_form_submissions_company on public.form_submissions (company_id);
create index idx_form_submissions_application on public.form_submissions (application_id);

-- ---------- RLS ---------------------------------------------
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_submissions enable row level security;

-- forms: company members manage their company's forms
create policy "forms_select_member" on public.forms
  for select using (public.is_company_member(company_id));
create policy "forms_insert_member" on public.forms
  for insert with check (public.is_company_member(company_id));
create policy "forms_update_member" on public.forms
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy "forms_delete_member" on public.forms
  for delete using (public.is_company_member(company_id));

-- form_fields: governed by the parent form's company
create policy "form_fields_select_member" on public.form_fields
  for select using (
    exists (select 1 from public.forms f
            where f.id = form_id and public.is_company_member(f.company_id))
  );
create policy "form_fields_insert_member" on public.form_fields
  for insert with check (
    exists (select 1 from public.forms f
            where f.id = form_id and public.is_company_member(f.company_id))
  );
create policy "form_fields_update_member" on public.form_fields
  for update using (
    exists (select 1 from public.forms f
            where f.id = form_id and public.is_company_member(f.company_id))
  );
create policy "form_fields_delete_member" on public.form_fields
  for delete using (
    exists (select 1 from public.forms f
            where f.id = form_id and public.is_company_member(f.company_id))
  );

-- form_submissions: company members read theirs; applicant reads own.
-- Inserts happen through apply_to_job() (SECURITY DEFINER).
create policy "form_submissions_select_company" on public.form_submissions
  for select using (public.is_company_member(company_id));
create policy "form_submissions_select_applicant" on public.form_submissions
  for select using (public.is_applicant_owner(applicant_id));

-- ---------- PUBLIC: get a job's application form fields ------
create or replace function public.get_application_form(p_job_id uuid)
returns table (
  field_id uuid,
  label text,
  field_type public.form_field_type,
  required boolean,
  options jsonb,
  help_text text,
  "position" int
)
language sql security definer stable set search_path = public
as $$
  select ff.id, ff.label, ff.field_type, ff.required, ff.options, ff.help_text, ff.position
  from public.jobs j
  join public.form_fields ff on ff.form_id = j.application_form_id
  where j.id = p_job_id
    and j.status = 'published'
    and j.application_form_id is not null
  order by ff.position, ff.created_at;
$$;

-- ---------- Extend apply_to_job to store custom answers ------
-- Drop the previous 8-arg version first; we're adding p_form_answers,
-- which would otherwise create an ambiguous overload.
drop function if exists public.apply_to_job(
  uuid, text, text, text, text, text, text, jsonb
);

create or replace function public.apply_to_job(
  p_job_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_postcode text,
  p_cover_message text,
  p_cv_path text,
  p_answers jsonb default '{}'::jsonb,
  p_form_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_applicant_id uuid;
  v_company_id uuid;
  v_status public.job_status;
  v_form_id uuid;
  v_email text;
  v_application_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to apply';
  end if;

  select company_id, status, application_form_id
    into v_company_id, v_status, v_form_id
  from public.jobs where id = p_job_id;
  if v_company_id is null then
    raise exception 'Job not found';
  end if;
  if v_status <> 'published' then
    raise exception 'This job is not currently accepting applications';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.applicants (user_id, first_name, last_name, email, phone, postcode)
  values (auth.uid(), p_first_name, p_last_name, v_email, p_phone, p_postcode)
  on conflict (user_id) do update
    set first_name = coalesce(excluded.first_name, public.applicants.first_name),
        last_name  = coalesce(excluded.last_name, public.applicants.last_name),
        phone      = coalesce(excluded.phone, public.applicants.phone),
        postcode   = coalesce(excluded.postcode, public.applicants.postcode)
  returning id into v_applicant_id;

  insert into public.applications
    (company_id, job_id, applicant_id, cover_message, cv_path, answers)
  values
    (v_company_id, p_job_id, v_applicant_id, p_cover_message, p_cv_path, coalesce(p_answers, '{}'::jsonb))
  on conflict (job_id, applicant_id) do nothing
  returning id into v_application_id;

  if v_application_id is null then
    raise exception 'You have already applied for this role';
  end if;

  -- Store custom form answers, if this job has an assigned form.
  if v_form_id is not null and p_form_answers is not null and p_form_answers <> '{}'::jsonb then
    insert into public.form_submissions
      (company_id, form_id, application_id, applicant_id, answers)
    values
      (v_company_id, v_form_id, v_application_id, v_applicant_id, p_form_answers)
    on conflict (application_id, form_id) do nothing;
  end if;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'application.created', 'application', v_application_id,
          jsonb_build_object('job_id', p_job_id));

  return v_application_id;
end;
$$;
