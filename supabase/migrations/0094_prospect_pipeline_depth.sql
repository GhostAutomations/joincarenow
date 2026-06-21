-- ============================================================
-- JOIN CARE NOW — Migration 0094: richer sales pipeline
-- Adds an estimated monthly value (for pipeline totals/forecast) and a
-- stage_changed_at timestamp (for "days in stage"). Founder-only table.
-- Run AFTER 0093_prospect_sequences.sql.
-- ============================================================

alter table public.prospect_companies
  add column if not exists value_monthly numeric,
  add column if not exists stage_changed_at timestamptz not null default now();
