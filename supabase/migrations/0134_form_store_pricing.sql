-- ============================================================
-- JOIN CARE NOW — Migration 0134: Form Store per-form pricing
-- Replaces the old free/pro/enterprise subscription-tier gating (which never
-- matched the single-plan pricing model) with a one-off price per store form.
-- A store form with price_pence = 0 is included/free; anything above is a
-- per-form purchase charged to the company's saved card on Add.
-- `form_purchases` records each purchase (audit + idempotency: one purchase
-- per company per store form, so a form is never double-charged).
-- Run AFTER 0010_form_store.sql.
-- ============================================================

-- Price (in pence) the founder sets on a store form. 0 = free / included.
alter table public.forms
  add column if not exists price_pence integer not null default 0;

-- Record of a company buying a paid store form.
create table if not exists public.form_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  store_form_id uuid not null references public.forms(id) on delete cascade,
  form_id uuid references public.forms(id) on delete set null, -- the company's copy
  price_pence integer not null default 0,
  stripe_invoice_id text,
  purchased_by uuid,
  created_at timestamptz not null default now(),
  -- Idempotency: one company can only buy a given store form once.
  unique (company_id, store_form_id)
);

create index if not exists form_purchases_company_idx
  on public.form_purchases (company_id);

alter table public.form_purchases enable row level security;

-- Company members (and platform admins) can read their own purchases. Writes
-- happen server-side via the service-role client only — no client insert/update.
drop policy if exists "form_purchases_select" on public.form_purchases;
create policy "form_purchases_select" on public.form_purchases
  for select using (public.is_company_member(company_id) or public.is_platform_admin());
