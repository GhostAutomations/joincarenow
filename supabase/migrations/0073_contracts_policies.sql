-- ============================================================
-- JOIN CARE NOW — Migration 0073: Contract templates + policy documents
-- Admin-only library of reusable employment-contract templates and policy
-- documents. Bodies are plain text with {{merge_fields}} (first_name, role, pay,
-- start_date, company_name, etc.). Versioned: editing bumps a version number so
-- already-signed copies (which snapshot the text) are never altered.
-- Jobs assign one contract template + any number of policies; offers inherit
-- these and the applicant signs them on accept (built in later slices).
-- Run AFTER 0072_offer_decline_realtime_touch.sql.
-- ============================================================

-- Contract templates ---------------------------------------------------------
create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  body text not null default '',
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index if not exists idx_contract_templates_company on public.contract_templates (company_id);
drop trigger if exists trg_contract_templates_updated on public.contract_templates;
create trigger trg_contract_templates_updated before update on public.contract_templates
  for each row execute function public.set_updated_at();

alter table public.contract_templates enable row level security;
drop policy if exists contract_templates_select on public.contract_templates;
create policy contract_templates_select on public.contract_templates
  for select using (public.is_company_member(company_id));
drop policy if exists contract_templates_insert on public.contract_templates;
create policy contract_templates_insert on public.contract_templates
  for insert with check (public.is_company_admin(company_id));
drop policy if exists contract_templates_update on public.contract_templates;
create policy contract_templates_update on public.contract_templates
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
drop policy if exists contract_templates_delete on public.contract_templates;
create policy contract_templates_delete on public.contract_templates
  for delete using (public.is_company_admin(company_id));

-- Policy documents -----------------------------------------------------------
create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  body text not null default '',
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index if not exists idx_policy_documents_company on public.policy_documents (company_id);
drop trigger if exists trg_policy_documents_updated on public.policy_documents;
create trigger trg_policy_documents_updated before update on public.policy_documents
  for each row execute function public.set_updated_at();

alter table public.policy_documents enable row level security;
drop policy if exists policy_documents_select on public.policy_documents;
create policy policy_documents_select on public.policy_documents
  for select using (public.is_company_member(company_id));
drop policy if exists policy_documents_insert on public.policy_documents;
create policy policy_documents_insert on public.policy_documents
  for insert with check (public.is_company_admin(company_id));
drop policy if exists policy_documents_update on public.policy_documents;
create policy policy_documents_update on public.policy_documents
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
drop policy if exists policy_documents_delete on public.policy_documents;
create policy policy_documents_delete on public.policy_documents
  for delete using (public.is_company_admin(company_id));

-- Job assignment -------------------------------------------------------------
alter table public.jobs
  add column if not exists contract_template_id uuid
    references public.contract_templates (id) on delete set null;

create table if not exists public.job_policies (
  job_id uuid not null references public.jobs (id) on delete cascade,
  policy_id uuid not null references public.policy_documents (id) on delete cascade,
  primary key (job_id, policy_id)
);
create index if not exists idx_job_policies_job on public.job_policies (job_id);

alter table public.job_policies enable row level security;
-- Inherit access from the parent job's company.
drop policy if exists job_policies_select on public.job_policies;
create policy job_policies_select on public.job_policies
  for select using (exists (
    select 1 from public.jobs j where j.id = job_id and public.is_company_member(j.company_id)
  ));
drop policy if exists job_policies_write on public.job_policies;
create policy job_policies_write on public.job_policies
  for all using (exists (
    select 1 from public.jobs j where j.id = job_id and public.is_company_admin(j.company_id)
  ))
  with check (exists (
    select 1 from public.jobs j where j.id = job_id and public.is_company_admin(j.company_id)
  ));
