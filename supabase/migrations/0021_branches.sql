-- ============================================================
-- JOIN CARE NOW — Migration 0021: Branches
-- Admins maintain a list of branches per company. Jobs are assigned
-- to a branch (replacing the old free-text location/region), and the
-- branch is snapshotted onto the employee at hire. This prevents
-- duplicate / mistyped locations and drives the employee breakdown.
-- Run AFTER 0020_hr.sql.
-- ============================================================

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists idx_branches_company on public.branches (company_id);

alter table public.branches enable row level security;

drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches
  for select using (public.is_company_member(company_id));
drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches
  for insert with check (public.is_company_admin(company_id));
drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches
  for delete using (public.is_company_admin(company_id));

alter table public.jobs
  add column if not exists branch_id uuid references public.branches (id) on delete set null;
alter table public.employees
  add column if not exists branch_id uuid references public.branches (id) on delete set null,
  add column if not exists branch text;

-- Snapshot branch (id + name) onto the employee at hire.
create or replace function public.create_employee_from_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid; v_applicant_id uuid; v_start_date date;
  v_job_title text; v_branch_id uuid; v_branch text; v_worker_category text;
  v_first text; v_last text; v_email text; v_phone text;
  v_existing uuid; v_next int; v_ref text; v_employee_id uuid;
begin
  select a.company_id, a.applicant_id, a.start_date, j.title, j.branch_id, b.name, j.worker_category
    into v_company_id, v_applicant_id, v_start_date, v_job_title, v_branch_id, v_branch, v_worker_category
  from public.applications a
  join public.jobs j on j.id = a.job_id
  left join public.branches b on b.id = j.branch_id
  where a.id = p_application_id;

  if v_company_id is null then return null; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  select id into v_existing from public.employees where application_id = p_application_id;
  if v_existing is not null then return v_existing; end if;

  select first_name, last_name, email, phone into v_first, v_last, v_email, v_phone
    from public.applicants where id = v_applicant_id;

  select coalesce(max((regexp_replace(employee_ref, '\D', '', 'g'))::int), 0) + 1 into v_next
    from public.employees
    where company_id = v_company_id and employee_ref ~ '^EMP-\d+$' for update;
  v_ref := 'EMP-' || lpad(v_next::text, 4, '0');

  insert into public.employees
    (company_id, applicant_id, application_id, employee_ref, first_name, last_name,
     email, phone, job_title, branch_id, branch, worker_category, start_date, status)
  values
    (v_company_id, v_applicant_id, p_application_id, v_ref, v_first, v_last,
     v_email, v_phone, v_job_title, v_branch_id, v_branch, v_worker_category, v_start_date, 'active')
  returning id into v_employee_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'employee.created', 'employee', v_employee_id,
          jsonb_build_object('employee_ref', v_ref, 'application_id', p_application_id));

  return v_employee_id;
end; $$;

-- Careers pages now show the branch name as the job location.
create or replace function public.get_company_careers(p_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, location text,
  employment_type text, salary text
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title,
         coalesce(b.name, j.location), j.employment_type, j.salary
  from public.companies c
  left join public.jobs j on j.company_id = c.id and j.status = 'published'
  left join public.branches b on b.id = j.branch_id
  where c.slug = p_slug
  order by j.created_at desc;
$$;

create or replace function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, description text,
  location text, employment_type text, salary text,
  vacancies int, closing_date date
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title, j.description,
         coalesce(b.name, j.location), j.employment_type, j.salary, j.vacancies, j.closing_date
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.branches b on b.id = j.branch_id
  where c.slug = p_company_slug and j.slug = p_job_slug and j.status = 'published';
$$;
