-- ============================================================
-- JOIN CARE NOW — Migration 0089: platform error log
-- A central place to record server/app exceptions and failed email/SMS sends so
-- the Founder can see all errors (with codes + detail) in one screen. Written by
-- the service-role logError() helper; readable by platform admins.
-- Run AFTER 0088_platform_admin_manage.sql.
-- ============================================================

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  source text not null,        -- e.g. 'email', 'sms', 'api/cron/reminders', 'client'
  code text,                   -- provider / error code if any
  message text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_created on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

drop policy if exists error_logs_platform_admin on public.error_logs;
create policy error_logs_platform_admin on public.error_logs
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
