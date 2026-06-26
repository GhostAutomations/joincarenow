-- ============================================================
-- JOIN CARE NOW — Migration 0122: Form Store publish state
-- Store templates are now DRAFT until the founder publishes them. Only published
-- templates appear in companies' Form Store. Existing store templates default to
-- draft (false) — the founder publishes the ones that should be live.
-- Run AFTER 0121_more_field_types.sql.
-- ============================================================

alter table public.forms
  add column if not exists store_published boolean not null default false;
