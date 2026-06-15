-- ============================================================
-- JOIN CARE NOW — Migration 0023: Employee number mode
-- Companies choose how Employee IDs are assigned:
--   • auto   — generated as <prefix><sequence> (default 'EMP-')
--   • manual — left blank at hire so staff enter the company's own
--              payroll / employee number on the record.
-- Settings live in companies.settings:
--   employee_number_mode ('auto'|'manual'), employee_number_prefix.
-- Run AFTER 0022_roles.sql.
-- ============================================================

-- Manual mode needs a blank ref at hire, so the column becomes nullable.
alter table public.employees alter column employee_ref drop not null;

create or replace function public.create_employee_from_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid; v_applicant_id uuid; v_start_date date;
  v_job_title text; v_branch_id uuid; v_branch text; v_worker_category text;
  v_first text; v_last text; v_email text; v_phone text;
  v_existing uuid; v_next int; v_ref text; v_employee_id uuid;
  v_settings jsonb; v_mode text; v_prefix text;
begin
  select a.company_id, a.applicant_id, a.start_date, j.title, j.branch_id, b.name,
         coalesce(ro.name, j.worker_category)
    into v_company_id, v_applicant_id, v_start_date, v_job_title, v_branch_id, v_branch, v_worker_category
  from public.applications a
  join public.jobs j on j.id = a.job_id
  left join public.branches b on b.id = j.branch_id
  left join public.roles ro on ro.id = j.role_id
  where a.id = p_application_id;
  if v_company_id is null then return null; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  select id into v_existing from public.employees where application_id = p_application_id;
  if v_existing is not null then return v_existing; end if;

  select first_name, last_name, email, phone into v_first, v_last, v_email, v_phone
    from public.applicants where id = v_applicant_id;

  select settings into v_settings from public.companies where id = v_company_id;
  v_mode := coalesce(v_settings->>'employee_number_mode', 'auto');
  v_prefix := coalesce(v_settings->>'employee_number_prefix', 'EMP-');

  if v_mode = 'manual' then
    v_ref := null;  -- staff will enter the company's own number on the record
  else
    select coalesce(max((regexp_replace(employee_ref, '\D', '', 'g'))::int), 0) + 1 into v_next
      from public.employees
      where company_id = v_company_id
        and employee_ref like v_prefix || '%'
        and employee_ref ~ '\d'
      for update;
    v_ref := v_prefix || lpad(v_next::text, 4, '0');
  end if;

  insert into public.employees
    (company_id, applicant_id, application_id, employee_ref, first_name, last_name,
     email, phone, job_title, branch_id, branch, worker_category, start_date, status)
  values
    (v_company_id, v_applicant_id, p_application_id, v_ref, v_first, v_last,
     v_email, v_phone, v_job_title, v_branch_id, v_branch, v_worker_category, v_start_date, 'active')
  returning id into v_employee_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'employee.created', 'employee', v_employee_id,
          jsonb_build_object('employee_ref', v_ref));

  return v_employee_id;
end; $$;
