-- ============================================================
-- JOIN CARE NOW — Migration 0150: File Store for docs
-- Extends the File Store (previously forms only) to contract templates, policy
-- documents and job descriptions. Mirrors the Form Store pattern (0010 / 0122 /
-- 0134): founder-owned store rows have company_id = NULL + is_store = true, are
-- DRAFT until store_published, carry a one-off price_pence, and are deep-copied
-- into a company on purchase (source_id -> the store row, so the copy is
-- decoupled and freely editable). A bought contract/policy lands in the company's
-- contract/policy library; a bought job description lands in the JD library and
-- shows up automatically when creating a job (jobs.job_description_id).
-- Run AFTER 0149_dbs_two_sided.sql.
-- ============================================================

-- ---------- Store columns on the three doc tables -----------
-- Store rows belong to no company.
alter table public.contract_templates alter column company_id drop not null;
alter table public.policy_documents   alter column company_id drop not null;
alter table public.job_descriptions   alter column company_id drop not null;

alter table public.contract_templates
  add column if not exists is_store         boolean not null default false,
  add column if not exists store_published  boolean not null default false,
  add column if not exists price_pence       integer not null default 0,
  add column if not exists store_category    text,
  add column if not exists store_description text,
  add column if not exists source_id         uuid references public.contract_templates (id) on delete set null;

alter table public.policy_documents
  add column if not exists is_store         boolean not null default false,
  add column if not exists store_published  boolean not null default false,
  add column if not exists price_pence       integer not null default 0,
  add column if not exists store_category    text,
  add column if not exists store_description text,
  add column if not exists source_id         uuid references public.policy_documents (id) on delete set null;

alter table public.job_descriptions
  add column if not exists is_store         boolean not null default false,
  add column if not exists store_published  boolean not null default false,
  add column if not exists price_pence       integer not null default 0,
  add column if not exists store_category    text,
  add column if not exists store_description text,
  add column if not exists source_id         uuid references public.job_descriptions (id) on delete set null;

create index if not exists idx_contract_templates_store on public.contract_templates (is_store) where is_store;
create index if not exists idx_policy_documents_store   on public.policy_documents   (is_store) where is_store;
create index if not exists idx_job_descriptions_store   on public.job_descriptions   (is_store) where is_store;

-- ---------- RLS: store catalogue (mirrors workflow store 0123) ----------
-- Any signed-in user may read PUBLISHED store rows (so a company admin can browse
-- the store); the founder also sees their own drafts. These policies are ADDITIVE
-- to the existing company-scoped policies (Postgres OR-combines them), so a
-- store row (company_id NULL) is only reachable through these, and a company's
-- own rows stay reachable through the existing is_company_member/admin policies.

-- contract_templates
drop policy if exists contract_templates_select_store on public.contract_templates;
create policy contract_templates_select_store on public.contract_templates
  for select using (is_store = true and (store_published = true or public.is_platform_admin()));
drop policy if exists contract_templates_insert_store on public.contract_templates;
create policy contract_templates_insert_store on public.contract_templates
  for insert with check (is_store = true and public.is_platform_admin());
drop policy if exists contract_templates_update_store on public.contract_templates;
create policy contract_templates_update_store on public.contract_templates
  for update using (is_store = true and public.is_platform_admin())
  with check (is_store = true and public.is_platform_admin());
drop policy if exists contract_templates_delete_store on public.contract_templates;
create policy contract_templates_delete_store on public.contract_templates
  for delete using (is_store = true and public.is_platform_admin());

-- policy_documents
drop policy if exists policy_documents_select_store on public.policy_documents;
create policy policy_documents_select_store on public.policy_documents
  for select using (is_store = true and (store_published = true or public.is_platform_admin()));
drop policy if exists policy_documents_insert_store on public.policy_documents;
create policy policy_documents_insert_store on public.policy_documents
  for insert with check (is_store = true and public.is_platform_admin());
drop policy if exists policy_documents_update_store on public.policy_documents;
create policy policy_documents_update_store on public.policy_documents
  for update using (is_store = true and public.is_platform_admin())
  with check (is_store = true and public.is_platform_admin());
drop policy if exists policy_documents_delete_store on public.policy_documents;
create policy policy_documents_delete_store on public.policy_documents
  for delete using (is_store = true and public.is_platform_admin());

-- job_descriptions
drop policy if exists job_descriptions_select_store on public.job_descriptions;
create policy job_descriptions_select_store on public.job_descriptions
  for select using (is_store = true and (store_published = true or public.is_platform_admin()));
drop policy if exists job_descriptions_insert_store on public.job_descriptions;
create policy job_descriptions_insert_store on public.job_descriptions
  for insert with check (is_store = true and public.is_platform_admin());
drop policy if exists job_descriptions_update_store on public.job_descriptions;
create policy job_descriptions_update_store on public.job_descriptions
  for update using (is_store = true and public.is_platform_admin())
  with check (is_store = true and public.is_platform_admin());
drop policy if exists job_descriptions_delete_store on public.job_descriptions;
create policy job_descriptions_delete_store on public.job_descriptions
  for delete using (is_store = true and public.is_platform_admin());

-- ---------- Purchase records (audit + idempotency + billing) ----------
-- One uniform shape per type, mirroring form_purchases (0134). Writes happen
-- server-side via the service-role client only; company members may read theirs.
-- unique(company_id, store_id): a store item is never double-charged.

create table if not exists public.contract_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  store_id uuid not null references public.contract_templates (id) on delete cascade,
  copy_id uuid references public.contract_templates (id) on delete set null,
  price_pence integer not null default 0,
  stripe_invoice_id text,
  purchased_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, store_id)
);
create index if not exists contract_purchases_company_idx on public.contract_purchases (company_id);
alter table public.contract_purchases enable row level security;
drop policy if exists contract_purchases_select on public.contract_purchases;
create policy contract_purchases_select on public.contract_purchases
  for select using (public.is_company_member(company_id) or public.is_platform_admin());

create table if not exists public.policy_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  store_id uuid not null references public.policy_documents (id) on delete cascade,
  copy_id uuid references public.policy_documents (id) on delete set null,
  price_pence integer not null default 0,
  stripe_invoice_id text,
  purchased_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, store_id)
);
create index if not exists policy_purchases_company_idx on public.policy_purchases (company_id);
alter table public.policy_purchases enable row level security;
drop policy if exists policy_purchases_select on public.policy_purchases;
create policy policy_purchases_select on public.policy_purchases
  for select using (public.is_company_member(company_id) or public.is_platform_admin());

create table if not exists public.job_description_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  store_id uuid not null references public.job_descriptions (id) on delete cascade,
  copy_id uuid references public.job_descriptions (id) on delete set null,
  price_pence integer not null default 0,
  stripe_invoice_id text,
  purchased_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, store_id)
);
create index if not exists job_description_purchases_company_idx on public.job_description_purchases (company_id);
alter table public.job_description_purchases enable row level security;
drop policy if exists job_description_purchases_select on public.job_description_purchases;
create policy job_description_purchases_select on public.job_description_purchases
  for select using (public.is_company_member(company_id) or public.is_platform_admin());
