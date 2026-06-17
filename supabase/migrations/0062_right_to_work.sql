-- ============================================================
-- JOIN CARE NOW — Migration 0062: Right to Work verification
-- The recruiter uploads the confirmed RTW document, records the share code and
-- expiry, and declares they have checked the original and it is a true likeness.
-- Run AFTER 0061_group_ungrouped_workflow_templates.sql.
-- ============================================================

alter table public.applications
  add column if not exists rtw_doc_path text,
  add column if not exists rtw_share_code text,
  add column if not exists rtw_expiry date,
  add column if not exists rtw_verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists rtw_verified_at timestamptz;
