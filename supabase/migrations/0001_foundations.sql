-- ============================================================
-- JOIN CARE NOW — Migration 0001: Foundations
-- Identity, multi-tenancy, audit logging, RLS helpers.
-- Run via Supabase Dashboard SQL Editor or `supabase db push`.
-- ============================================================

-- ---------- 1. PROFILES (mirrors auth.users) ----------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. COMPANIES (tenant root) ----------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. COMPANY MEMBERSHIPS --------------------------

create type public.company_role as enum ('admin', 'manager', 'recruiter');

create table public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.company_role not null default 'recruiter',
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index idx_company_users_user on public.company_users (user_id);
create index idx_company_users_company on public.company_users (company_id);

-- ---------- 4. AUDIT LOGS (append-only) ----------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,            -- e.g. 'company.created', 'application.stage_changed'
  entity_type text not null,       -- e.g. 'company', 'application'
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_company_created on public.audit_logs (company_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

-- ---------- 5. RLS HELPER FUNCTIONS --------------------------
-- SECURITY DEFINER so they can read memberships without recursive
-- RLS evaluation. STABLE so Postgres caches them per-statement.

create or replace function public.is_platform_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.company_users
    where company_id = target_company_id and user_id = auth.uid()
  ) or public.is_platform_admin();
$$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.company_users
    where company_id = target_company_id
      and user_id = auth.uid()
      and role = 'admin'
  ) or public.is_platform_admin();
$$;

-- ---------- 6. ROW LEVEL SECURITY POLICIES -------------------

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES: you can see/edit yourself; platform admins see all.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = (select p.is_platform_admin from public.profiles p where p.id = auth.uid()));
  -- ^ users cannot grant themselves platform admin

-- COMPANIES: members read; admins update. Creation only via RPC below.
create policy "companies_select_member" on public.companies
  for select using (public.is_company_member(id));

create policy "companies_update_admin" on public.companies
  for update using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

-- COMPANY_USERS: members can see their company's roster; admins manage it.
create policy "company_users_select_member" on public.company_users
  for select using (public.is_company_member(company_id));

create policy "company_users_insert_admin" on public.company_users
  for insert with check (public.is_company_admin(company_id));

create policy "company_users_update_admin" on public.company_users
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

create policy "company_users_delete_admin" on public.company_users
  for delete using (
    public.is_company_admin(company_id)
    and user_id <> auth.uid()  -- admins cannot remove themselves (prevents orphaned companies)
  );

-- AUDIT_LOGS: company admins read their own company's logs; nobody
-- inserts/updates/deletes directly (writes go through log_audit()).
create policy "audit_logs_select_admin" on public.audit_logs
  for select using (public.is_company_admin(company_id));

-- ---------- 7. RPCs (atomic operations) ----------------------

-- Create a company and make the caller its admin, atomically.
create or replace function public.create_company(company_name text, company_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(company_name)) < 2 then
    raise exception 'Company name too short';
  end if;

  insert into public.companies (name, slug)
  values (trim(company_name), company_slug)
  returning id into new_company_id;

  insert into public.company_users (company_id, user_id, role)
  values (new_company_id, auth.uid(), 'admin');

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (new_company_id, auth.uid(), 'company.created', 'company', new_company_id,
          jsonb_build_object('name', company_name, 'slug', company_slug));

  return new_company_id;
end;
$$;

-- Generic audit writer for application code (server-side only use).
create or replace function public.log_audit(
  p_company_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not a member of this company';
  end if;
  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, before, after)
  values (p_company_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
end;
$$;

-- ---------- 8. updated_at maintenance ------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();
