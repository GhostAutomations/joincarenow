-- ============================================================
-- JOIN CARE NOW — Migration 0123: Workflow Store (founder-owned workflows)
-- Mirrors the Form Store (0010) one level up: the founder curates reusable
-- onboarding WORKFLOWS (grouped onboarding_templates) that get deep-copied into
-- a company at setup. Store rows have company_id = NULL + is_store = true, are
-- DRAFT until published, and reference store forms for their form-steps.
-- Run AFTER 0122_store_published.sql.
-- ============================================================

-- Store workflow rows belong to no company.
alter table public.onboarding_templates
  alter column company_id drop not null;

alter table public.onboarding_templates
  add column if not exists is_store boolean not null default false,
  add column if not exists store_published boolean not null default false;

-- Founder-store metadata reused from existing grouping columns: workflow_id +
-- workflow_name group the steps; an optional category/description for the
-- browser card live on the workflow's first row via these columns.
alter table public.onboarding_templates
  add column if not exists store_category text,
  add column if not exists store_description text;

create index if not exists idx_onb_templates_store
  on public.onboarding_templates (is_store, workflow_id) where is_store;

-- ---------- RLS: store catalogue ----------------------------
-- Any signed-in user may read PUBLISHED store workflows (so a company admin can
-- preview what's available); the founder also sees their own drafts.
drop policy if exists onb_tpl_select_store on public.onboarding_templates;
create policy onb_tpl_select_store on public.onboarding_templates
  for select using (
    is_store = true and (store_published = true or public.is_platform_admin())
  );

-- Only the founder (platform admin) manages store workflows.
drop policy if exists onb_tpl_insert_store on public.onboarding_templates;
create policy onb_tpl_insert_store on public.onboarding_templates
  for insert with check (is_store = true and public.is_platform_admin());

drop policy if exists onb_tpl_update_store on public.onboarding_templates;
create policy onb_tpl_update_store on public.onboarding_templates
  for update using (is_store = true and public.is_platform_admin())
  with check (is_store = true and public.is_platform_admin());

drop policy if exists onb_tpl_delete_store on public.onboarding_templates;
create policy onb_tpl_delete_store on public.onboarding_templates
  for delete using (is_store = true and public.is_platform_admin());
