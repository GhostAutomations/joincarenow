-- ============================================================
-- JOIN CARE NOW — Migration 0063: regroup workflow templates by role
-- 0061 only merged templates with no workflow group. Some were saved as separate
-- workflows (distinct workflow_ids), so they still showed as separate cards.
-- This regroups ALL existing templates per (company, role) into one workflow,
-- named "<Role> workflow". New workflows built via the builder are unaffected.
-- Run AFTER 0062_right_to_work.sql.
-- ============================================================

update public.onboarding_templates t
set workflow_id = g.wid,
    workflow_name = g.wname
from (
  select company_id, role_id,
         gen_random_uuid() as wid,
         coalesce((select r.name || ' workflow' from public.roles r where r.id = role_id), 'Workflow') as wname
  from public.onboarding_templates
  group by company_id, role_id
) g
where t.company_id = g.company_id
  and t.role_id is not distinct from g.role_id;
