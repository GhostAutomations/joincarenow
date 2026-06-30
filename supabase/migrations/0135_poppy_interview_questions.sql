-- ============================================================
-- JOIN CARE NOW — Migration 0135: Poppy (AI assistant) — slice 1
-- Poppy is the umbrella brand for premium AI features. Slice 1 adds:
--   1. A per-company entitlement flag (founder-toggleable for now; the Settings
--      Poppy app + Stripe pricing options come in a later slice).
--   2. Storage for AI-generated interview questions per application.
-- Interview questions are STAFF-ONLY: this table has no applicant policy, so
-- applicants can never read them even though they can read their own application.
-- Run AFTER 0003_jobs_applicants_applications.sql.
-- ============================================================

-- Per-company Poppy entitlement (slice 2 will drive this from a subscription).
alter table public.companies
  add column if not exists poppy_enabled boolean not null default false;

-- AI-generated interview questions for an application (one current set per app).
create table if not exists public.application_interview_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  questions jsonb not null default '[]'::jsonb,
  model text,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  -- One current set per application; regenerate overwrites it.
  unique (application_id)
);

create index if not exists aiq_company_idx
  on public.application_interview_questions (company_id);

alter table public.application_interview_questions enable row level security;

-- Staff-only: company members + platform admins can read. Writes are server-side
-- via the service-role client only (no client insert/update; applicants excluded).
drop policy if exists "aiq_select" on public.application_interview_questions;
create policy "aiq_select" on public.application_interview_questions
  for select using (public.is_company_member(company_id) or public.is_platform_admin());
