-- ============================================================
-- JOIN CARE NOW — Migration 0068: accepting an offer auto-hires
-- When an applicant accepts their offer, move them to Hired and create their
-- employee record. The employee-creation logic is split into a no-guard internal
-- function so the applicant-context accept can reuse it. Carer.Academy sync still
-- happens via the recruiter (drag-to-Hired or resend) since the webhook is app-side.
-- Run AFTER 0067_my_offers.sql.
-- ============================================================

-- Internal: create the employee record without a membership guard (system use).
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
  select coalesce(max((regexp_replace(employee_ref,'\D','','g'))::int),0)+1 into v_next
    from public.employees where company_id = v_company_id and employee_ref ~ '^EMP-\d+$' for update;
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

-- Public wrapper keeps the membership guard, then delegates.
create or replace function public.create_employee_from_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company_id uuid;
begin
  select company_id into v_company_id from public.applications where id = p_application_id;
  if v_company_id is null then return null; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;
  return public._create_employee_internal(p_application_id);
end; $$;

-- Accepting an offer also moves the applicant to Hired + creates the employee.
create or replace function public.respond_to_offer_by_token(p_token uuid, p_response text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_application_id uuid; v_status text;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  select id, company_id, application_id, status into v_id, v_company_id, v_application_id, v_status
  from public.offers where token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  update public.offers set status = p_response, responded_at = now() where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.' || p_response, 'offer', v_id, jsonb_build_object('via', 'token'));

  -- On acceptance, move to Hired and create the employee record.
  if p_response = 'accepted' then
    update public.applications
    set stage = 'hired', hired_at = coalesce(hired_at, now())
    where id = v_application_id and stage <> 'hired';
    perform public._create_employee_internal(v_application_id);
  end if;
end;
$$;

grant execute on function public.respond_to_offer_by_token(uuid, text) to anon, authenticated;
