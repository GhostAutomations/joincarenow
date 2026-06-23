-- ============================================================
-- JOIN CARE NOW — Migration 0100: billing snapshots
-- One row per day capturing MRR + plan counts, so the founder billing console
-- can show revenue trends over time. Run AFTER 0099_billing_comped.sql.
-- ============================================================

create table if not exists public.billing_snapshots (
  snapshot_date date primary key,
  mrr numeric not null default 0,
  paying integer not null default 0,
  monthly integer not null default 0,
  annual integer not null default 0,
  committed integer not null default 0,
  comped integer not null default 0,
  past_due integer not null default 0,
  total integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.billing_snapshots enable row level security;

drop policy if exists billing_snapshots_founder on public.billing_snapshots;
create policy billing_snapshots_founder on public.billing_snapshots
  for select to authenticated
  using (public.is_platform_admin());
