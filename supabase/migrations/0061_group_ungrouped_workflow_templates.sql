-- ============================================================
-- JOIN CARE NOW — Migration 0061: group orphaned workflow templates
-- Older onboarding_templates were saved without a shared workflow_id, so the
-- Workflow board showed each as its own card. Group any ungrouped templates by
-- (company, role) into a single workflow so they appear as one workflow.
-- Run AFTER 0060_application_hired_at.sql.
-- ============================================================

update public.onboarding_templates t
set workflow_id = g.wid,
    workflow_name = g.wname
from (
  select company_id, role_id,
         gen_random_uuid() as wid,
         coalesce((select r.name || ' workflow' from public.roles r where r.id = role_id), 'Workflow') as wname
  from public.onboarding_templates
  where workflow_id is null
  group by company_id, role_id
) g
where t.workflow_id is null
  and t.company_id = g.company_id
  and t.role_id is not distinct from g.role_id;
