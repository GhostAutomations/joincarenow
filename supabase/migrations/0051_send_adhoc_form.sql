-- ============================================================
-- JOIN CARE NOW — Migration 0051: send an ad-hoc form from the pipeline
-- Staff can't INSERT onboarding_tasks directly (no RLS insert policy — tasks are
-- created by SECURITY DEFINER functions). This RPC creates a form task for an
-- application so it appears in the applicant's portal and behaves like any other
-- workflow form. Run AFTER 0050_reference_form_by_category.sql.
-- ============================================================

create or replace function public.send_adhoc_form(p_application_id uuid, p_form_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_name text;
  v_pos int;
  v_id uuid;
begin
  select a.company_id, a.applicant_id into v_company_id, v_applicant_id
  from public.applications a where a.id = p_application_id;
  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  select name into v_name from public.forms
  where id = p_form_id and company_id = v_company_id;
  if v_name is null then raise exception 'Form not found'; end if;

  if exists (
    select 1 from public.onboarding_tasks
    where application_id = p_application_id and form_id = p_form_id
  ) then
    raise exception 'That form has already been sent';
  end if;

  select coalesce(max(position), 0) + 1 into v_pos
  from public.onboarding_tasks where application_id = p_application_id;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, required, status, position)
  values
    (v_company_id, p_application_id, v_applicant_id, v_name, 'form', p_form_id, true, 'pending', v_pos)
  returning id into v_id;

  return v_id;
end;
$$;
