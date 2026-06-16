-- ============================================================
-- JOIN CARE NOW — Migration 0039: Workflow task role association
-- A workflow task can be tied to a Role (from Settings). Null = applies to
-- everyone. Lets the workflow target role-specific tasks (e.g. Driver checks).
-- Run AFTER 0038_workflow_due_days.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists role_id uuid references public.roles (id) on delete set null;

-- When tasks fire at a trigger stage, only create those whose role matches the
-- applicant's job role (or have no role = applies to everyone).
create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_role_id uuid;
begin
  select a.company_id, a.applicant_id, j.role_id
    into v_company_id, v_applicant_id, v_role_id
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
  if v_company_id is null then return; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required,
         case when t.due_days is not null then (current_date + t.due_days) else null end,
         t.id, t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id
    and t.trigger_stage = p_trigger
    and (t.role_id is null or t.role_id = v_role_id)
    and not exists (
      select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id
    );
end;
$$;
