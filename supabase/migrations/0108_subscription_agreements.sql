-- Customer subscription agreement (Join Care Now ⇄ care company).
-- The plan the customer was sold is carried onto their company at provisioning,
-- and they must e-sign (type name + tick) the plan-specific terms during account
-- setup before the dashboard unlocks. We store a snapshot of the exact wording
-- they agreed to, plus who signed and when.

alter table public.companies add column if not exists agreed_plan text;   -- monthly | commit | annual
alter table public.companies add column if not exists agreed_offer text;  -- free-text sweetener, if any

create table if not exists public.company_agreements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  version       int  not null default 1,
  plan          text,
  offer         text,
  terms_snapshot text not null,      -- the exact wording the signer agreed to
  signer_user_id uuid references public.profiles (id) on delete set null,
  signer_name   text not null,       -- typed name
  signer_email  text,
  agreed_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_company_agreements_company on public.company_agreements (company_id);

alter table public.company_agreements enable row level security;

-- Members can read their company's agreement; platform admin can read all.
create policy "company_agreements_select" on public.company_agreements
  for select using (public.is_company_member(company_id) or public.is_platform_admin());

-- Only a company admin can record (sign) their own company's agreement.
create policy "company_agreements_insert" on public.company_agreements
  for insert with check (public.is_company_admin(company_id));
