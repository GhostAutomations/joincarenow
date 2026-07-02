-- ============================================================
-- JOIN CARE NOW — Migration 0142: Poppy step "what to compare to"
-- A Poppy workflow step can pick which company documents (policies / contracts)
-- Poppy compares the applicant against — overriding the company Settings default
-- for that step. NULL/empty = use the company default. The role's own job
-- description is always compared automatically (not listed here).
-- Run AFTER 0141_poppy_step_overrides.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists poppy_document_ids uuid[];
