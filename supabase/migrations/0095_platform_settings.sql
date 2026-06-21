-- ============================================================
-- JOIN CARE NOW — Migration 0095: platform settings (founder-only key/value)
-- Used for the AI auto-send mode for prospect replies. Run AFTER
-- 0094_prospect_pipeline_depth.sql.
-- ============================================================

create table if not exists public.platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_founder on public.platform_settings;
create policy platform_settings_founder on public.platform_settings
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Default the AI auto-send mode to 'all' (Phil's choice). Values: off | low_risk | all.
insert into public.platform_settings (key, value)
values ('prospect_autosend', 'all')
on conflict (key) do nothing;
