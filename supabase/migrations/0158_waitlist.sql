-- ============================================================
-- JOIN CARE NOW — Migration 0158: waitlist (Toflo coming-soon page)
-- Captures emails from the Toflo holding page (and any future coming-soon page,
-- keyed by source). Written only by the service-role API route; read by the
-- founder. RLS on with no policies = locked to service role. Run AFTER 0157.
-- ============================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null default 'toflo',
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_waitlist_email_source
  on public.waitlist (source, lower(email));

alter table public.waitlist enable row level security;
