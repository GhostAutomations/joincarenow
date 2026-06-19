-- ============================================================
-- JOIN CARE NOW — Migration 0078: allow admins to delete employees
-- The employees table had select + update RLS but no DELETE policy, so the
-- "Delete employee" action silently removed zero rows. Add a delete policy for
-- company admins. Run AFTER 0077_realtime_onboarding_tasks.sql.
-- ============================================================

drop policy if exists employees_delete_admin on public.employees;
create policy employees_delete_admin on public.employees
  for delete using (public.is_company_admin(company_id));
