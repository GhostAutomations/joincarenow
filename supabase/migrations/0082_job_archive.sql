-- ============================================================
-- JOIN CARE NOW — Migration 0082: archive jobs
-- Adds an 'archived' job status + archived_at timestamp. Archived jobs leave the
-- pipeline and the active jobs list and sit in a reopenable Archived section.
-- The archive guard (every applicant hired or not-progressing) is enforced in
-- the server action. Run AFTER 0081_rejection_talent_pool.sql.
-- ============================================================

alter type public.job_status add value if not exists 'archived';

alter table public.jobs
  add column if not exists archived_at timestamptz;
