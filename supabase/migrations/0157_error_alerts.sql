-- ============================================================
-- JOIN CARE NOW — Migration 0157: error alerting
-- The platform already logs server + client errors to error_logs and shows them
-- in the founder console. This adds an `alerted_at` stamp so a cron can email the
-- platform admin a digest of NEW errors once, without re-sending. Run AFTER 0156.
-- ============================================================

alter table public.error_logs add column if not exists alerted_at timestamptz;

-- Fast lookup of not-yet-alerted errors for the alert cron.
create index if not exists idx_error_logs_unalerted
  on public.error_logs (created_at)
  where alerted_at is null;
