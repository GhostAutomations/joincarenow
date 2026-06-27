-- ============================================================
-- JOIN CARE NOW — Migration 0127: Founder workflow archive + folders
-- Lets the founder archive their custom STORE workflows into named folders so
-- the active list (and the company-setup apply picker) stays clean. This only
-- affects the founder's master store rows — companies own decoupled copies
-- (see applyStoreWorkflow), so archiving never touches a company's workflow.
-- Run AFTER 0126_public_form_meta.sql, then `ship`.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists store_archived boolean not null default false,
  add column if not exists store_folder text;

-- Quickly fetch archived store workflows grouped by folder.
create index if not exists idx_onb_templates_store_archived
  on public.onboarding_templates (store_archived, store_folder)
  where is_store;
