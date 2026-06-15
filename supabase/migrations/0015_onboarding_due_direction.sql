-- ============================================================
-- JOIN CARE NOW — Migration 0015: Onboarding due direction
-- Tasks can be due a number of days BEFORE or AFTER the start date.
-- Adds applications.start_date (the new starter's first day).
-- Run AFTER 0014_onboarding.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists due_direction text not null default 'after';

alter table public.onboarding_tasks
  add column if not exists due_days int,
  add column if not exists due_direction text not null default 'after';

alter table public.applications
  add column if not exists start_date date;

-- Copy due_days + due_direction onto instantiated tasks.
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
     due_days, due_direction, position)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required, t.due_days, t.due_direction, t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id
  order by t.position;
end;
$$;
