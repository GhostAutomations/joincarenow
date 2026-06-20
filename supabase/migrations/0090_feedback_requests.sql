-- ============================================================
-- JOIN CARE NOW — Migration 0090: feedback + feature requests
-- Feedback: any company member can give feedback (4-week window enforced in the
-- action); the Founder responds. Feature requests: company admins only; the
-- Founder quotes a price, the admin accepts/declines.
-- Run AFTER 0089_error_logs.sql.
-- ============================================================

-- ---------- Feedback ----------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  response text,
  responded_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_company on public.feedback (company_id, created_at desc);
alter table public.feedback enable row level security;

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (public.is_company_member(company_id) or public.is_platform_admin());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (public.is_company_member(company_id));

drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------- Feature requests ----------
create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null,
  status text not null default 'new' check (status in ('new', 'quoted', 'accepted', 'declined')),
  quote_amount text,
  quote_note text,
  quoted_by uuid references public.profiles (id) on delete set null,
  quoted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_feature_requests_company on public.feature_requests (company_id, created_at desc);
alter table public.feature_requests enable row level security;

drop policy if exists feature_requests_select on public.feature_requests;
create policy feature_requests_select on public.feature_requests
  for select using (public.is_company_admin(company_id) or public.is_platform_admin());

drop policy if exists feature_requests_insert on public.feature_requests;
create policy feature_requests_insert on public.feature_requests
  for insert with check (public.is_company_admin(company_id));

drop policy if exists feature_requests_update on public.feature_requests;
create policy feature_requests_update on public.feature_requests
  for update using (public.is_company_admin(company_id) or public.is_platform_admin())
  with check (public.is_company_admin(company_id) or public.is_platform_admin());
