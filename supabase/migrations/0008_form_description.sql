-- ============================================================
-- JOIN CARE NOW — Migration 0008: Form description
-- Intro/instructions shown at the top of the form (how to complete it).
-- Run AFTER 0007_form_category.sql.
-- ============================================================

alter table public.forms
  add column if not exists description text;
