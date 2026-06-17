-- ============================================================
-- JOIN CARE NOW — Migration 0041: Workflow grouping
-- Tasks created together in one "Create Workflow" share a workflow_id and the
-- workflow's name, so the checklist can group them as a single workflow.
-- Run AFTER 0040_job_workflow_role.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists workflow_id uuid,
  add column if not exists workflow_name text;

create index if not exists idx_onb_templates_workflow
  on public.onboarding_templates (company_id, workflow_id);
