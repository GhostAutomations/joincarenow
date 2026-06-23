-- ============================================================
-- JOIN CARE NOW — Migration 0098: 12-month commitment
-- A monthly plan can be taken on a 12-month commitment (no setup fee, can't be
-- cancelled before the term ends). We record the date the commitment runs to.
-- Run AFTER 0097_billing.sql.
-- ============================================================

alter table public.companies
  add column if not exists commitment_until timestamptz;
