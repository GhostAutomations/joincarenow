-- ============================================================
-- JOIN CARE NOW — Migration 0016: Onboarding due as a fixed date
-- Checklist tasks now carry a plain due date (no before/after).
-- Run AFTER 0015_onboarding_due_direction.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists due_date date;

create or replace function public.start_onboarding(p_application_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
begin
  select company_id, applicant_id into v_company_id, v_applicant_id
  from public.applications where id = p_application_id;
  if v_company_id is null then return; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;
  if exists (select 1 from public.onboarding_tasks where application_id = p_application_id) then
    return;
  end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, position)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required, t.due_date, t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id
  order by t.position;
end;
$$;
