-- ============================================================
-- JOIN CARE NOW — Migration 0143: applicants can apply (fix create_stage_tasks)
-- Two fixes to public.create_stage_tasks, which apply_to_job calls on every
-- application:
--   1. The guard only allowed company members / platform admins, so a genuine
--      (non-member) applicant was blocked with 'Not allowed' and the whole
--      application rolled back. Now ALSO allow the applicant who owns the
--      application (their own on_application task seeding at apply time). Staff-
--      triggered stage advances still require membership.
--   2. Exclude Poppy steps (task_type='poppy') from task seeding — they are
--      workflow triggers, not applicant onboarding tasks. (Poppy steps carry a
--      placeholder trigger_stage='on_application' to satisfy NOT NULL, which
--      would otherwise match here.)
-- Idempotent (CREATE OR REPLACE). Already applied to production via hotfix.
-- Run AFTER 0129_workflow_role_set.sql.
-- ============================================================

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

  -- Company member / platform admin (staff-triggered stages) OR the applicant
  -- who owns this application (their own on_application seeding at apply).
  if not (
    public.is_company_member(v_company_id)
    or exists (
      select 1 from public.applicants ap
      where ap.id = v_applicant_id and ap.user_id = auth.uid()
    )
  ) then
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
    and t.task_type <> 'poppy'   -- Poppy steps are workflow triggers, not applicant tasks
    and (
      (coalesce(array_length(t.role_ids, 1), 0) = 0 and t.role_id is null)
      or (v_role_id is not null and v_role_id = any (t.role_ids))
      or (v_role_id is not null and t.role_id = v_role_id)
    )
    and not exists (
      select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id
    );
end;
$$;
