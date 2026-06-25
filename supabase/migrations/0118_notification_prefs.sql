-- ============================================================
-- JOIN CARE NOW — Migration 0118: per-user notification preferences
-- Each user chooses how they're notified about applicant activity on the jobs
-- they own (in-app and/or email, per event). Stored on their own profile.
-- Missing/unset = both channels on. Run AFTER 0117_job_owner.sql.
-- ============================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb;

-- Shape (all keys optional; absent = both on):
--   { "new_application": { "inApp": true, "email": true },
--     "applicant_message": { "inApp": true, "email": false } }
-- Users update their own row via the existing profiles update RLS policy.
