-- ============================================================
-- JOIN CARE NOW — Migration 0136: Poppy as a workflow step (Slice A)
-- Poppy becomes a step type in the recruitment workflow. The company places it
-- in the order and configures WHEN it engages and WHICH forms feed it:
--   poppy_engage : 'all_forms'  → run once all feeding forms are complete
--                  'as_forms'   → run as each feeding form comes in
--                  'stage'      → run when the applicant reaches trigger_stage
--   poppy_form_ids : the forms (company form ids) Poppy reviews
-- When it runs, Poppy writes a poppy_reports row for the job owner. Reports are
-- STAFF-ONLY (no applicant policy). Run AFTER 0135_poppy_interview_questions.sql.
-- ============================================================

-- New workflow step type. ADD VALUE is safe outside a txn that USES it (PG15).
alter type public.onboarding_task_type add value if not exists 'poppy';

-- Poppy config on the workflow definition + the per-applicant task.
alter table public.onboarding_templates
  add column if not exists poppy_engage text,
  add column if not exists poppy_form_ids uuid[];

alter table public.onboarding_tasks
  add column if not exists poppy_engage text,
  add column if not exists poppy_form_ids uuid[];

-- One report per application (the current Poppy review for that candidate).
create table if not exists public.poppy_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  task_id uuid references public.onboarding_tasks(id) on delete set null,
  status text not null default 'pending', -- pending | ready | error
  report jsonb not null default '{}'::jsonb,
  error text,
  model text,
  notified_owner_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id)
);

create index if not exists poppy_reports_company_idx on public.poppy_reports (company_id);

alter table public.poppy_reports enable row level security;

-- Staff-only: company members + platform admins read. Writes server-side only.
drop policy if exists "poppy_reports_select" on public.poppy_reports;
create policy "poppy_reports_select" on public.poppy_reports
  for select using (public.is_company_member(company_id) or public.is_platform_admin());
