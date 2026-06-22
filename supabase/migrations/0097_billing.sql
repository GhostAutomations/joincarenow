-- ============================================================
-- JOIN CARE NOW — Migration 0097: billing (Stripe)
-- Subscription state on companies + a usage_events table for metered add-ons
-- (SMS, AI). Run AFTER 0096_realtime_prospects.sql.
-- ============================================================

alter table public.companies
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text not null default 'none'
    check (billing_status in ('none','trialing','active','past_due','canceled','incomplete')),
  add column if not exists billing_interval text
    check (billing_interval in ('month','year')),
  add column if not exists current_period_end timestamptz,
  add column if not exists setup_fee_paid boolean not null default false,
  add column if not exists extra_branches integer not null default 0;

-- Metered usage we bill on top of the base plan (100 SMS/mo included, then 8p;
-- AI actions 10p each). One row per chargeable event; reported_at is set once
-- the usage has been pushed to Stripe.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('sms','ai')),
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  reported_at timestamptz
);
create index if not exists idx_usage_events_company_kind
  on public.usage_events (company_id, kind, created_at);

alter table public.usage_events enable row level security;

-- Company members see their own usage; founder sees all. Inserts are server-side
-- (service-role) only, so there is no insert/update policy for normal users.
drop policy if exists usage_events_read on public.usage_events;
create policy usage_events_read on public.usage_events
  for select to authenticated
  using (public.is_company_member(company_id) or public.is_platform_admin());
