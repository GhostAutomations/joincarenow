-- ============================================================
-- JOIN CARE NOW — Migration 0139: Billing tiers + Poppy applicant credits
-- Introduces a two-tier plan model and per-applicant Poppy metering.
--   1. companies.plan_tier ('core' | 'poppy'). Tier 2 ('poppy') includes the
--      Poppy AI recruitment assistant. Backfilled from the existing
--      poppy_enabled flag so nothing changes for current companies.
--   2. poppy_applicant_credits — one row per applicant Poppy touches, deduped by
--      application_id so an applicant is reported to Stripe at most once. Every
--      credit reports 1 usage unit; the included allowance (40/mo, 480/yr) is
--      applied by the Stripe Price's graduated tiers (first N units £0, rest 75p).
-- poppy_enabled remains the runtime gate (unchanged); plan_tier is the
-- billing-facing field and is kept in sync in code.
-- Run AFTER 0135_poppy_interview_questions.sql and 0138_poppy_conversation.sql.
-- ============================================================

-- Two-tier plan model. 'core' = Tier 1; 'poppy' = Tier 2 (includes Poppy).
alter table public.companies
  add column if not exists plan_tier text not null default 'core'
    check (plan_tier in ('core', 'poppy'));

-- Existing Poppy companies map to Tier 2 so entitlement is unchanged.
update public.companies set plan_tier = 'poppy'
  where poppy_enabled = true and plan_tier <> 'poppy';

-- The tier the founder sold at setup (drives the activation checkout, like
-- agreed_plan). plan_tier is what they're actually on; agreed_tier is intent.
alter table public.companies
  add column if not exists agreed_tier text not null default 'core'
    check (agreed_tier in ('core', 'poppy'));

-- One credit per applicant Poppy screens. UNIQUE(application_id) guarantees an
-- applicant can only ever consume a single credit, however many times Poppy runs.
-- `charged` marks the credits that fell beyond the monthly allowance (metered at
-- 75p); included credits stay charged=false.
create table if not exists public.poppy_applicant_credits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  charged boolean not null default false,
  consumed_at timestamptz not null default now(),
  unique (application_id)
);

create index if not exists poppy_credits_company_month_idx
  on public.poppy_applicant_credits (company_id, consumed_at);

alter table public.poppy_applicant_credits enable row level security;

-- Staff-only visibility (for usage display); platform admins see all. Writes are
-- server-side via the service-role client only — no client insert/update, and no
-- applicant policy, so applicants can never read Poppy billing data.
drop policy if exists "poppy_credits_select" on public.poppy_applicant_credits;
create policy "poppy_credits_select" on public.poppy_applicant_credits
  for select using (public.is_company_member(company_id) or public.is_platform_admin());
