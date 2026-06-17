-- ============================================================
-- JOIN CARE NOW — Migration 0042: Application form review status
-- The application form (submitted at apply time) can be approved or resent for
-- changes, just like workflow form tasks. Status lives on its form_submission.
-- Run AFTER 0041_workflow_grouping.sql.
-- ============================================================

alter table public.form_submissions
  add column if not exists review_status text not null default 'submitted'
    check (review_status in ('submitted', 'approved', 'rejected')),
  add column if not exists review_note text;
