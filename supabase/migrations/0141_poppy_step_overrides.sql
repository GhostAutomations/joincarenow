-- ============================================================
-- JOIN CARE NOW — Migration 0141: Poppy step-level overrides
-- A Poppy workflow step can override the company-default agent tuning (focus,
-- custom instructions, number of questions) set in Settings. NULL/empty means
-- "use the company default". Reference documents stay company-level.
-- Run AFTER 0136_poppy_workflow_step.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists poppy_focus text[],
  add column if not exists poppy_instructions text,
  add column if not exists poppy_question_count integer;
