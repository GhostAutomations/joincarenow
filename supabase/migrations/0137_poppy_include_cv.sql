-- ============================================================
-- JOIN CARE NOW — Migration 0137: Poppy can review the CV (Slice A refinement)
-- The "Forms Poppy reviews" picker gains a CV option. Stored as a boolean
-- (poppy_form_ids is uuid[] and can't hold a 'cv' marker). When on, Poppy
-- includes the applicant's uploaded CV and counts it toward the engage
-- condition (CV "complete" = a CV has been uploaded).
-- Run AFTER 0136_poppy_workflow_step.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists poppy_include_cv boolean not null default false;

alter table public.onboarding_tasks
  add column if not exists poppy_include_cv boolean not null default false;
