-- ============================================================
-- JOIN CARE NOW — Migration 0069: fix employee-ref allocation
-- Postgres rejects `FOR UPDATE` together with an aggregate (max), which broke
-- _create_employee_internal on the offer-accept path with:
--   "FOR UPDATE is not allowed with aggregate functions".
-- Replace the row lock with a per-company transaction advisory lock so concurrent
-- hires still allocate unique EMP-#### refs without locking an aggregate.
-- Run AFTER 0068_offer_accept_auto_hire.sql.
-- ============================================================

create or replace function public._create_employee_internal(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid; v_applicant_id uuid; v_start_date date;
  v_job_title text; v_branch_id uuid; v_branch text; v_worker_category text;
  v_first text; v_last text; v_email text; v_phone text;
  v_existing uuid; v_next int; v_ref text; v_employee_id uuid;
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
  select id into v_existing from public.employees where application_id = p_application_id;
  if v_existing is not null then return v_existing; end if;
  select first_name, last_name, email, phone into v_first, v_last, v_email, v_phone
    from public.applicants where id = v_applicant_id;

  -- Serialise ref allocation per company (replaces the invalid FOR UPDATE on an aggregate).
  perform pg_advisory_xact_lock(hashtext('employee_ref:' || v_company_id::text));
  select coalesce(max((regexp_replace(employee_ref,'\D','','g'))::int),0)+1 into v_next
    from public.employees where company_id = v_company_id and employee_ref ~ '^EMP-\d+$';
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
          jsonb_build_object('employee_ref', v_ref));
  return v_employee_id;
end; $$;
