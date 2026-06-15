-- ============================================================
-- JOIN CARE NOW — Migration 0020: HR records
-- Per-employee HR data: absence tracking, disciplinary warnings,
-- and an HR document store (letters, certificates, contracts).
-- All managed by company members; isolated per company by RLS.
-- Run AFTER 0019_region_worker_category.sql.
-- ============================================================

do $$ begin
  create type public.absence_type as enum ('sickness', 'holiday', 'unauthorised', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.warning_level as enum ('verbal', 'written', 'final');
exception when duplicate_object then null; end $$;

-- ---------- Absences -----------------------------------------
create table if not exists public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  absence_type public.absence_type not null default 'sickness',
  start_date date not null,
  end_date date,
  days numeric(5,1),
  reason text,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_absences_employee on public.employee_absences (employee_id);

-- ---------- Warnings / disciplinary --------------------------
create table if not exists public.employee_warnings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  level public.warning_level not null default 'verbal',
  title text not null,
  note text,
  issued_date date not null default current_date,
  review_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_warnings_employee on public.employee_warnings (employee_id);

-- ---------- HR documents -------------------------------------
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  doc_type text,                       -- e.g. 'Contract', 'Letter', 'Certificate'
  title text not null,
  file_path text not null,             -- object path in the private hr-documents bucket
  issued_date date,
  expiry_date date,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_hrdocs_employee on public.employee_documents (employee_id);

-- ---------- RLS: company members manage their own ------------
alter table public.employee_absences enable row level security;
alter table public.employee_warnings enable row level security;
alter table public.employee_documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['employee_absences','employee_warnings','employee_documents'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))',
      t, t
    );
  end loop;
end $$;

-- ---------- Private HR document bucket -----------------------
-- Path convention: {company_id}/{employee_id}/{file}. Staff of the
-- company can upload/read within their company's folder.
insert into storage.buckets (id, name, public)
values ('hr-documents', 'hr-documents', false)
on conflict (id) do nothing;

drop policy if exists hr_docs_insert on storage.objects;
create policy hr_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hr-documents'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists hr_docs_select on storage.objects;
create policy hr_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hr-documents'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists hr_docs_delete on storage.objects;
create policy hr_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hr-documents'
    and public.is_company_member(((storage.foldername(name))[1])::uuid)
  );
