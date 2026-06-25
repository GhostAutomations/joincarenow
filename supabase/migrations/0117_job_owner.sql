-- ============================================================
-- JOIN CARE NOW — Migration 0117: job owner (managed by)
-- Each job has an owner (a company user) who manages it and receives the
-- notifications for its applicants. Backfilled to whoever created the job.
-- Ownership can be transferred (e.g. when someone goes on holiday). Run AFTER
-- 0116_request_document.sql.
-- ============================================================

alter table public.jobs
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- Backfill: existing jobs are owned by their creator.
update public.jobs
  set owner_id = created_by
  where owner_id is null and created_by is not null;

create index if not exists idx_jobs_owner on public.jobs (owner_id);
