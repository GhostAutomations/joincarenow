-- ============================================================
-- JOIN CARE NOW — Migration 0083: saved rejection reasons
-- Lets a company save its own Not-progressing reasons (name + message) so they
-- appear in the popup dropdown for next time. Run AFTER 0082_job_archive.sql.
-- ============================================================

create table if not exists public.rejection_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rejection_templates_company on public.rejection_templates (company_id);

alter table public.rejection_templates enable row level security;

-- Any member of the company can read and add reasons; admins can also delete.
drop policy if exists rejection_templates_select on public.rejection_templates;
create policy rejection_templates_select on public.rejection_templates
  for select using (public.is_company_member(company_id));

drop policy if exists rejection_templates_insert on public.rejection_templates;
create policy rejection_templates_insert on public.rejection_templates
  for insert with check (public.is_company_member(company_id));

drop policy if exists rejection_templates_delete on public.rejection_templates;
create policy rejection_templates_delete on public.rejection_templates
  for delete using (public.is_company_admin(company_id));
