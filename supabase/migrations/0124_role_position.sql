-- ============================================================
-- JOIN CARE NOW — Migration 0124: Role ordering
-- Roles get an explicit display order (founder/admin can drag to reorder in the
-- setup popup / Settings). Previously sorted alphabetically. Run AFTER
-- 0123_workflow_store.sql.
-- ============================================================

alter table public.roles
  add column if not exists position int not null default 0;

-- Backfill: keep the current (alphabetical) order so nothing jumps on deploy.
with ordered as (
  select id, (row_number() over (partition by company_id order by name) - 1) as rn
  from public.roles
)
update public.roles r
  set position = o.rn
  from ordered o
  where o.id = r.id;

create index if not exists idx_roles_position on public.roles (company_id, position);
