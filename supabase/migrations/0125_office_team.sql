-- ============================================================
-- JOIN CARE NOW — Migration 0125: Office Team
-- Companies recruit for care BRANCHES (locations) and now also an OFFICE TEAM
-- (head-office staff). Modelled as a special branch (kind = 'office') so jobs,
-- careers, pipeline and employee records reuse the existing branch machinery.
-- Roles are tagged care | office. Run AFTER 0124_role_position.sql.
-- ============================================================

-- Roles belong to a team.
alter table public.roles
  add column if not exists team text not null default 'care'
    check (team in ('care', 'office'));

-- Branches can be a real location ('branch') or the office team ('office').
alter table public.branches
  add column if not exists kind text not null default 'branch'
    check (kind in ('branch', 'office'));

-- Tag the default office roles (names match the seeded set).
update public.roles
  set team = 'office'
  where team <> 'office'
    and name in ('Supervisor', 'Planner', 'Branch Manager', 'Registered Manager', 'Registered Individual');

-- Give every existing company an Office Team target if it doesn't have one.
insert into public.branches (company_id, name, kind)
select c.id, 'Office Team', 'office'
from public.companies c
where not exists (
  select 1 from public.branches b where b.company_id = c.id and b.kind = 'office'
)
on conflict (company_id, name) do nothing;

create index if not exists idx_roles_team on public.roles (company_id, team, position);
create index if not exists idx_branches_kind on public.branches (company_id, kind);
