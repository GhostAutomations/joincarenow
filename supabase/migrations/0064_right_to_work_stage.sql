-- ============================================================
-- JOIN CARE NOW — Migration 0064: Right to Work pipeline stage
-- Adds a "right_to_work" stage between Interview and Offer. ADD VALUE auto-commits
-- and isn't used in this migration, so it's safe in its own file.
-- Run AFTER 0063_regroup_all_workflow_templates_by_role.sql.
-- ============================================================

alter type public.application_stage add value if not exists 'right_to_work' before 'offer';
