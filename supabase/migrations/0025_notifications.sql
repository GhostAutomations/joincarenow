-- ============================================================
-- JOIN CARE NOW — Migration 0025: Notifications
-- Per-user in-app notifications (e.g. an applicant replied by SMS).
-- One row per recipient so each team member has their own read state.
-- Run AFTER 0024_communications.sql.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,                 -- e.g. 'sms_received'
  title text not null,
  body text,
  link text,                          -- in-app path to open
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

-- Each user sees and updates only their own notifications.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Inserts happen server-side via the service-role client (webhooks/actions).
