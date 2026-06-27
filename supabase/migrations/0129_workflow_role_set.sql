-- ============================================================
-- JOIN CARE NOW — Migration 0129: workflows apply to a SET of roles
-- A workflow (group of onboarding_templates sharing workflow_id) can now apply
-- to several roles at once, shown as ONE workflow.
--   - Company workflows: role_ids uuid[]  (which company roles it applies to)
--   - Founder STORE workflows: role_names text[] (standard role names; mapped to
--     a company's matching roles when the workflow is applied)
-- Empty/null role_ids AND null role_id  => applies to ALL roles (unchanged).
-- Existing single role_id values are backfilled into role_ids.
-- create_stage_tasks now matches on role_ids (with role_id back-compat).
-- Run via `ship`.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists role_ids uuid[],
  add column if not exists role_names text[];

-- Backfill: a row bound to a single role becomes a one-element role_ids set.
update public.onboarding_templates
set role_ids = array[role_id]
where role_id is not null
  and (role_ids is null or array_length(role_ids, 1) is null);

create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_role_id uuid;
begin
  select a.company_id, a.applicant_id, coalesce(j.workflow_role_id, j.role_id)
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
    and (
      -- applies to everyone
      (coalesce(array_length(t.role_ids, 1), 0) = 0 and t.role_id is null)
      -- applies to this job's role (set, or legacy single)
      or (v_role_id is not null and v_role_id = any (t.role_ids))
      or (v_role_id is not null and t.role_id = v_role_id)
    )
    and not exists (
      select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id
    );
end;
$$;
