-- ============================================================
-- JOIN CARE NOW — Migration 0010: Form Store
-- Founder-created template forms (company_id NULL, is_store) that
-- company admins can copy into their own forms, gated by the
-- company's subscription tier. Run AFTER 0009_form_style.sql.
-- ============================================================

-- Store forms have no owning company.
alter table public.forms alter column company_id drop not null;

alter table public.forms
  add column if not exists is_store boolean not null default false,
  add column if not exists store_tier text not null default 'free',
  add column if not exists source_form_id uuid references public.forms (id) on delete set null;

alter table public.companies
  add column if not exists subscription_tier text not null default 'free';

create index if not exists idx_forms_store on public.forms (is_store) where is_store;

-- ---------- RLS: store catalogue ----------------------------
-- Any signed-in user can browse store forms + their fields.
create policy forms_select_store on public.forms
  for select using (is_store = true);

create policy form_fields_select_store on public.form_fields
  for select using (
    exists (select 1 from public.forms f where f.id = form_id and f.is_store = true)
  );

-- Only the founder (platform admin) manages store forms.
create policy forms_insert_store on public.forms
  for insert with check (is_store = true and public.is_platform_admin());
create policy forms_update_store on public.forms
  for update using (is_store = true and public.is_platform_admin())
  with check (is_store = true and public.is_platform_admin());
create policy forms_delete_store on public.forms
  for delete using (is_store = true and public.is_platform_admin());
