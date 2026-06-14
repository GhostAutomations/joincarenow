-- ============================================================
-- JOIN CARE NOW — Migration 0007: Form category
-- Classify a form: recruitment | hr | onboarding | other.
-- Run AFTER 0006_form_fields_extras.sql.
-- ============================================================

alter table public.forms
  add column if not exists category text not null default 'recruitment';
