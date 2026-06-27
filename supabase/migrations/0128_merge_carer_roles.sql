-- ============================================================
-- JOIN CARE NOW — Migration 0128: merge Carer roles
-- Replaces the two default care roles "Carer (Walker)" and "Carer (Driver)"
-- with a single "Carer" role at EVERY company. References are repointed
-- (jobs.role_id, jobs.workflow_role_id, onboarding_templates.role_id), the
-- spare role is deleted, and any workflow that ended up applied twice to the
-- merged role (once per old role) is de-duplicated to a single copy.
-- The founder DEFAULT_ROLES seed is updated in code (starter-pack.ts).
-- Idempotent: safe to re-run (no Walker/Driver left = no-op).
-- Run via `ship`.
-- ============================================================

do $$
declare
  c record;
  keeper uuid;
  other record;
  dupwf record;
  keepwf uuid;
begin
  for c in (
    select distinct company_id
    from public.roles
    where company_id is not null
      and name in ('Carer (Walker)', 'Carer (Driver)', 'Carer')
  ) loop
    -- Establish the keeper "Carer" role for this company.
    select id into keeper
    from public.roles
    where company_id = c.company_id and name = 'Carer'
    order by position nulls last, created_at
    limit 1;

    if keeper is null then
      select id into keeper
      from public.roles
      where company_id = c.company_id and name in ('Carer (Walker)', 'Carer (Driver)')
      order by position nulls last, name
      limit 1;
      if keeper is null then continue; end if;
      update public.roles set name = 'Carer' where id = keeper;
    end if;

    -- Repoint references off the spare carer role(s), then delete them.
    for other in (
      select id from public.roles
      where company_id = c.company_id
        and id <> keeper
        and name in ('Carer (Walker)', 'Carer (Driver)', 'Carer')
    ) loop
      update public.jobs set role_id = keeper where role_id = other.id;
      update public.jobs set workflow_role_id = keeper where workflow_role_id = other.id;
      update public.onboarding_templates set role_id = keeper where role_id = other.id;
      delete from public.roles where id = other.id;
    end loop;

    -- De-dupe workflows now applied more than once to the merged role
    -- (same workflow_name): keep the earliest copy, drop the rest.
    for dupwf in (
      select workflow_name
      from public.onboarding_templates
      where company_id = c.company_id and is_store = false
        and role_id = keeper and workflow_id is not null
      group by workflow_name
      having count(distinct workflow_id) > 1
    ) loop
      select workflow_id into keepwf
      from public.onboarding_templates
      where company_id = c.company_id and is_store = false
        and role_id = keeper and workflow_name = dupwf.workflow_name
      order by created_at, workflow_id
      limit 1;

      delete from public.onboarding_templates
      where company_id = c.company_id and is_store = false
        and role_id = keeper and workflow_name = dupwf.workflow_name
        and workflow_id <> keepwf;
    end loop;
  end loop;
end $$;
