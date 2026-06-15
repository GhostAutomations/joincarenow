-- ============================================================
-- JOIN CARE NOW — Migration 0018: Employee Records
-- When an application reaches "hired", a master employee record is
-- created. It snapshots the person's details at the point of hire and
-- becomes the source of truth that future systems (Carer.Academy,
-- payroll, HR) will read from. All application/onboarding history is
-- retained via the applicant_id / application_id links.
-- Run AFTER 0017_workflow_triggers.sql.
-- ============================================================

-- start_date may already exist (migration 0015); ensure it's present.
alter table public.applications
  add column if not exists start_date date;

do $$ begin
  create type public.employee_status as enum ('active', 'inactive', 'left');
exception when duplicate_object then null; end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  applicant_id uuid references public.applicants (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  employee_ref text not null,                 -- human-friendly Employee ID, unique per company
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,                             -- role at hire
  department text,
  location text,
  manager_id uuid references public.profiles (id) on delete set null,
  start_date date,
  training_group text,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_ref),
  unique (application_id)                      -- one employee per hired application
);

create index if not exists idx_employees_company on public.employees (company_id);
create index if not exists idx_employees_applicant on public.employees (applicant_id);

drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------------------------------------------
alter table public.employees enable row level security;

drop policy if exists employees_select_member on public.employees;
create policy employees_select_member on public.employees
  for select using (public.is_company_member(company_id));

drop policy if exists employees_update_member on public.employees;
create policy employees_update_member on public.employees
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
-- Inserts go through create_employee_from_application() only.

-- ---------- Create employee from a hired application --------
create or replace function public.create_employee_from_application(p_application_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_start_date date;
  v_job_title text;
  v_location text;
  v_first text; v_last text; v_email text; v_phone text;
  v_existing uuid;
  v_next int;
  v_ref text;
  v_employee_id uuid;
begin
  select a.company_id, a.applicant_id, a.start_date, j.title, j.location
    into v_company_id, v_applicant_id, v_start_date, v_job_title, v_location
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if v_company_id is null then return null; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;

  -- idempotent: one employee per hired application
  select id into v_existing from public.employees where application_id = p_application_id;
  if v_existing is not null then return v_existing; end if;

  select first_name, last_name, email, phone
    into v_first, v_last, v_email, v_phone
  from public.applicants where id = v_applicant_id;

  -- Per-company sequential Employee ID, e.g. EMP-0001. Lock the company's
  -- rows to avoid two simultaneous hires colliding on the same number.
  select coalesce(max((regexp_replace(employee_ref, '\D', '', 'g'))::int), 0) + 1
    into v_next
  from public.employees
  where company_id = v_company_id and employee_ref ~ '^EMP-\d+$'
  for update;

  v_ref := 'EMP-' || lpad(v_next::text, 4, '0');

  insert into public.employees
    (company_id, applicant_id, application_id, employee_ref, first_name, last_name,
     email, phone, job_title, location, start_date, status)
  values
    (v_company_id, v_applicant_id, p_application_id, v_ref, v_first, v_last,
     v_email, v_phone, v_job_title, v_location, v_start_date, 'active')
  returning id into v_employee_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'employee.created', 'employee', v_employee_id,
          jsonb_build_object('employee_ref', v_ref, 'application_id', p_application_id));

  return v_employee_id;
end;
$$;
