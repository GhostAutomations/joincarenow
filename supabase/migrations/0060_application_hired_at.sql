-- ============================================================
-- JOIN CARE NOW — Migration 0060: application hired_at
-- Records when an application was moved to Hired, so the Referencing board can
-- archive a referee's card: immediately once the reference is approved, or 72h
-- after hire if the reference is still outstanding.
-- Run AFTER 0059_reference_questionnaire_dates_and_link.sql.
-- ============================================================

alter table public.applications
  add column if not exists hired_at timestamptz;

-- Backfill already-hired applications so their references archive sensibly.
update public.applications
set hired_at = now()
where stage = 'hired' and hired_at is null;
