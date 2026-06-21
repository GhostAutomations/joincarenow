-- ============================================================
-- JOIN CARE NOW — Migration 0091: Founder-only Prospect CRM ("Sales")
-- A lean internal sales CRM, fully isolated from customer-tenant data. Every
-- table is founder-only (RLS: is_platform_admin()). Nothing here references
-- applicants / employees / company_users / the customer `companies` table.
-- Run AFTER 0090_feedback_requests.sql.
-- ============================================================

-- ---------- Prospect companies ----------
create table if not exists public.prospect_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  setting_type text,                 -- domiciliary | residential | supported_living | other
  size_band text,                    -- e.g. "1-10", "11-50", "51-200", "200+"
  region text,
  website text,
  source text,                       -- where the lead came from
  stage text not null default 'new'  -- new|contacted|engaged|demo|proposal|won|lost
    check (stage in ('new','contacted','engaged','demo','proposal','won','lost')),
  notes text,
  retention_until date,              -- GDPR retention setting
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_prospect_companies_stage on public.prospect_companies (stage, created_at desc);

-- ---------- Prospect contacts ----------
create table if not exists public.prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_company_id uuid not null references public.prospect_companies (id) on delete cascade,
  name text,
  role text,                         -- registered manager | HR lead | owner-operator | other
  email text,
  phone text,
  consent_basis text,                -- lawful basis / source note (UK B2B PECR)
  opted_out boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_contacts_company on public.prospect_contacts (prospect_company_id);

-- ---------- Unified activity timeline (notes, messages, stage changes, tasks, system) ----------
create table if not exists public.prospect_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_company_id uuid not null references public.prospect_companies (id) on delete cascade,
  contact_id uuid references public.prospect_contacts (id) on delete set null,
  type text not null check (type in ('note','message','stage_change','task','system')),
  channel text check (channel in ('email','sms')),
  direction text check (direction in ('outbound','inbound')),
  subject text,
  body text,
  status text,                       -- sent|delivered|failed|opened|logged
  provider_id text,
  to_address text,
  meta jsonb,
  needs_approval boolean not null default false,  -- agent drafts park here (slice 6)
  high_risk boolean not null default false,       -- price/contract/compliance -> always human
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_activities_company on public.prospect_activities (prospect_company_id, created_at desc);

-- ---------- Follow-up tasks ----------
create table if not exists public.prospect_tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_company_id uuid not null references public.prospect_companies (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_tasks_due on public.prospect_tasks (due_date) where done = false;

-- ---------- Global suppression list (opt-outs can never be messaged) ----------
create table if not exists public.prospect_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_prospect_suppress_email on public.prospect_suppressions (lower(email)) where email is not null;
create unique index if not exists idx_prospect_suppress_phone on public.prospect_suppressions (phone) where phone is not null;

-- ---------- Founder-only RLS on every table ----------
do $$
declare t text;
begin
  foreach t in array array[
    'prospect_companies','prospect_contacts','prospect_activities','prospect_tasks','prospect_suppressions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_founder', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t || '_founder', t
    );
  end loop;
end $$;
