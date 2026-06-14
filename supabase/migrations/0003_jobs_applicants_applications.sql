-- ============================================================
-- JOIN CARE NOW — Migration 0003: Jobs, Applicants, Applications
-- Per-company careers funnel (NOT a public job board):
--   • Each company has its own careers page; applicants only see
--     the jobs of the company whose link they followed.
--   • Applicants self-register at the point of applying.
--   • One global applicant profile is reusable across companies.
--   • A company can only ever see applicants who applied TO IT.
-- Run AFTER 0002_invitations.sql.
-- ============================================================

-- ---------- 1. ENUMS ----------------------------------------

create type public.job_status as enum ('draft', 'published', 'closed');

create type public.application_stage as enum (
  'applied', 'reviewing', 'interview', 'offer', 'hired', 'rejected'
);

-- ---------- 2. JOBS -----------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  employment_type text,                 -- e.g. 'Full time', 'Part time', 'Bank'
  location text,
  salary text,                          -- free text, e.g. '£12.50/hour'
  vacancies int not null default 1 check (vacancies >= 1),
  closing_date date,
  status public.job_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

create index idx_jobs_company on public.jobs (company_id);
create index idx_jobs_status on public.jobs (status);

create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------- 3. APPLICANTS (global, reusable profile) --------

create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_applicants_user on public.applicants (user_id);

create trigger trg_applicants_updated before update on public.applicants
  for each row execute function public.set_updated_at();

-- ---------- 4. APPLICATIONS (applicant ↔ job ↔ company) -----

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  stage public.application_stage not null default 'applied',
  cover_message text,
  cv_path text,                         -- storage object path (private bucket)
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)         -- can't apply to the same job twice
);

create index idx_applications_company on public.applications (company_id);
create index idx_applications_job on public.applications (job_id);
create index idx_applications_applicant on public.applications (applicant_id);

create trigger trg_applications_updated before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------- 5. RLS HELPER: am I this applicant? -------------

create or replace function public.is_applicant_owner(target_applicant_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.applicants
    where id = target_applicant_id and user_id = auth.uid()
  );
$$;

-- ---------- 6. ROW LEVEL SECURITY ---------------------------

alter table public.jobs enable row level security;
alter table public.applicants enable row level security;
alter table public.applications enable row level security;

-- JOBS: company members manage their own jobs. (Public reads happen
-- through the SECURITY DEFINER careers RPCs below, so no anon policy
-- is needed here — keeps draft/closed jobs fully private.)
create policy "jobs_select_member" on public.jobs
  for select using (public.is_company_member(company_id));

create policy "jobs_insert_member" on public.jobs
  for insert with check (public.is_company_member(company_id));

create policy "jobs_update_member" on public.jobs
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "jobs_delete_member" on public.jobs
  for delete using (public.is_company_member(company_id));

-- APPLICANTS:
--   • the applicant sees/edits their own profile
--   • a company sees an applicant ONLY if they applied to that company
create policy "applicants_select_own" on public.applicants
  for select using (user_id = auth.uid());

create policy "applicants_select_by_company" on public.applicants
  for select using (
    exists (
      select 1 from public.applications a
      where a.applicant_id = applicants.id
        and public.is_company_member(a.company_id)
    )
  );

create policy "applicants_insert_own" on public.applicants
  for insert with check (user_id = auth.uid());

create policy "applicants_update_own" on public.applicants
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- APPLICATIONS:
--   • applicant sees their own applications (any company)
--   • company members see applications made to their company
--   • company members can advance the stage (pipeline)
create policy "applications_select_own" on public.applications
  for select using (public.is_applicant_owner(applicant_id));

create policy "applications_select_company" on public.applications
  for select using (public.is_company_member(company_id));

create policy "applications_update_company" on public.applications
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
-- (Inserts go through apply_to_job() below — no direct insert policy.)

-- ---------- 7. PUBLIC CAREERS RPCs --------------------------
-- These expose ONLY published jobs + safe company fields, so the
-- public careers pages never touch the tables directly.

create or replace function public.get_company_careers(p_slug text)
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  job_id uuid,
  job_slug text,
  title text,
  location text,
  employment_type text,
  salary text
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title, j.location,
         j.employment_type, j.salary
  from public.companies c
  left join public.jobs j
    on j.company_id = c.id and j.status = 'published'
  where c.slug = p_slug
  order by j.created_at desc;
$$;

create or replace function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  job_id uuid,
  job_slug text,
  title text,
  description text,
  location text,
  employment_type text,
  salary text,
  vacancies int,
  closing_date date
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title, j.description,
         j.location, j.employment_type, j.salary, j.vacancies, j.closing_date
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where c.slug = p_company_slug
    and j.slug = p_job_slug
    and j.status = 'published';
$$;

-- ---------- 8. APPLY TO A JOB -------------------------------
-- Creates (or reuses) the applicant profile, then records the
-- application. Runs as the authenticated applicant.

create or replace function public.apply_to_job(
  p_job_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_postcode text,
  p_cover_message text,
  p_cv_path text,
  p_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_applicant_id uuid;
  v_company_id uuid;
  v_status public.job_status;
  v_email text;
  v_application_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to apply';
  end if;

  -- job must exist and be published
  select company_id, status into v_company_id, v_status
  from public.jobs where id = p_job_id;
  if v_company_id is null then
    raise exception 'Job not found';
  end if;
  if v_status <> 'published' then
    raise exception 'This job is not currently accepting applications';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  -- upsert the global applicant profile for this user
  insert into public.applicants (user_id, first_name, last_name, email, phone, postcode)
  values (auth.uid(), p_first_name, p_last_name, v_email, p_phone, p_postcode)
  on conflict (user_id) do update
    set first_name = coalesce(excluded.first_name, public.applicants.first_name),
        last_name  = coalesce(excluded.last_name, public.applicants.last_name),
        phone      = coalesce(excluded.phone, public.applicants.phone),
        postcode   = coalesce(excluded.postcode, public.applicants.postcode)
  returning id into v_applicant_id;

  -- one application per job
  insert into public.applications
    (company_id, job_id, applicant_id, cover_message, cv_path, answers)
  values
    (v_company_id, p_job_id, v_applicant_id, p_cover_message, p_cv_path, coalesce(p_answers, '{}'::jsonb))
  on conflict (job_id, applicant_id) do nothing
  returning id into v_application_id;

  if v_application_id is null then
    raise exception 'You have already applied for this role';
  end if;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'application.created', 'application', v_application_id,
          jsonb_build_object('job_id', p_job_id));

  return v_application_id;
end;
$$;

-- ---------- 8b. MY APPLICATIONS (applicant portal) ----------
-- Returns the signed-in applicant's applications with job + company
-- names. SECURITY DEFINER because applicants can't read jobs/companies
-- of companies they don't belong to via RLS.

create or replace function public.get_my_applications()
returns table (
  application_id uuid,
  stage public.application_stage,
  created_at timestamptz,
  job_title text,
  company_name text,
  company_slug text,
  job_slug text
)
language sql security definer stable set search_path = public
as $$
  select a.id, a.stage, a.created_at, j.title, c.name, c.slug, j.slug
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.companies c on c.id = a.company_id
  join public.applicants ap on ap.id = a.applicant_id
  where ap.user_id = auth.uid()
  order by a.created_at desc;
$$;

-- ---------- 9. CV STORAGE BUCKET ----------------------------
-- Private bucket. Applicants upload only under their own user-id
-- folder. Staff never read via RLS — they get a short-lived signed
-- URL minted server-side after an app-level permission check.

insert into storage.buckets (id, name, public)
values ('applications', 'applications', false)
on conflict (id) do nothing;

create policy "applications_upload_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "applications_read_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'applications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
