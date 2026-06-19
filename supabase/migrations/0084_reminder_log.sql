-- ============================================================
-- JOIN CARE NOW — Migration 0084: reminder scheduler dedupe log
-- Records each automated reminder sent so the hourly cron never sends the same
-- one twice. Per-company reminder settings live in companies.settings.reminders
-- (jsonb, no schema change needed). Run AFTER 0083_rejection_templates.sql.
-- ============================================================

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null,                 -- interview | docs | onboarding | start_date
  dedupe_key text not null unique,    -- e.g. "interview:<id>:<iso>"
  sent_at timestamptz not null default now()
);

create index if not exists idx_reminder_log_company on public.reminder_log (company_id);

-- Locked down: only the service-role cron touches this (RLS on, no policies).
alter table public.reminder_log enable row level security;
