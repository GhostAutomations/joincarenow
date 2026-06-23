-- ============================================================
-- JOIN CARE NOW — Migration 0101: prospect demo + Won provisioning
-- Demo scheduling fields on the prospect, and a link to the company created
-- when the prospect is Won. Run AFTER 0100_billing_snapshots.sql.
-- ============================================================

alter table public.prospect_companies
  add column if not exists demo_at timestamptz,
  add column if not exists demo_contact_id uuid references public.prospect_contacts (id) on delete set null,
  add column if not exists provisioned_company_id uuid references public.companies (id) on delete set null;
