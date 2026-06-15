-- ============================================================
-- JOIN CARE NOW — Migration 0019: Region + worker category
-- Region/area and worker category are set on the JOB advert, then
-- snapshotted onto the employee record at hire. They drive the
-- breakdown widgets on the Employees page (region → category).
-- Run AFTER 0018_employees.sql.
-- ============================================================

alter table public.jobs
  add column if not exists region text,
  add column if not exists worker_category text;

alter table public.employees
  add column if not exists region text,
  add column if not exists worker_category text;

-- Recreate the hire RPC so it snapshots region + worker_category from the job.
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
  v_region text;
  v_worker_category text;
  v_first text; v_last text; v_email text; v_phone text;
  v_existing uuid;
  v_next int;
  v_ref text;
  v_employee_id uuid;
begin
  select a.company_id, a.applicant_id, a.start_date, j.title, j.location, j.region, j.worker_category
    into v_company_id, v_applicant_id, v_start_date, v_job_title, v_location, v_region, v_worker_category
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if v_company_id is null then return null; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;

  select id into v_existing from public.employees where application_id = p_application_id;
  if v_existing is not null then return v_existing; end if;

  select first_name, last_name, email, phone
    into v_first, v_last, v_email, v_phone
  from public.applicants where id = v_applicant_id;

  select coalesce(max((regexp_replace(employee_ref, '\D', '', 'g'))::int), 0) + 1
    into v_next
  from public.employees
  where company_id = v_company_id and employee_ref ~ '^EMP-\d+$'
  for update;

  v_ref := 'EMP-' || lpad(v_next::text, 4, '0');

  insert into public.employees
    (company_id, applicant_id, application_id, employee_ref, first_name, last_name,
     email, phone, job_title, location, region, worker_category, start_date, status)
  values
    (v_company_id, v_applicant_id, p_application_id, v_ref, v_first, v_last,
     v_email, v_phone, v_job_title, v_location, v_region, v_worker_category, v_start_date, 'active')
  returning id into v_employee_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'employee.created', 'employee', v_employee_id,
          jsonb_build_object('employee_ref', v_ref, 'application_id', p_application_id));

  return v_employee_id;
end;
$$;
