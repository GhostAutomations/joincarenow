-- ============================================================
-- JOIN CARE NOW — Migration 0102: demo end time (for conflict checks)
-- Storing the demo end lets us reject overlapping bookings. Run AFTER
-- 0101_prospect_demo_won.sql.
-- ============================================================

alter table public.prospect_companies
  add column if not exists demo_end_at timestamptz;

create index if not exists idx_prospect_demo_window
  on public.prospect_companies (demo_at, demo_end_at)
  where demo_at is not null;
