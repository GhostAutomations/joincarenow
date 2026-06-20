-- ============================================================
-- JOIN CARE NOW — Migration 0088: platform-admin "manage as company"
-- Adds a permissive platform-admin policy (FOR ALL) to every company-scoped
-- table so a Founder (is_platform_admin) can read and write a company's data
-- while "managing as" that company — using the exact same tools the company
-- uses, no duplicated screens. Existing company-member policies are unchanged;
-- PostgreSQL ORs permissive policies, so members are unaffected.
-- Run AFTER 0087_realtime_signed_documents.sql.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'companies', 'company_users', 'branches', 'roles', 'jobs', 'job_policies',
    'forms', 'form_fields', 'form_submissions', 'applications', 'employees',
    'employee_absences', 'employee_documents', 'employee_warnings',
    'interviews', 'onboarding_tasks', 'onboarding_templates',
    'contract_templates', 'policy_documents', 'offers', 'offer_policies',
    'message_templates', 'messages', 'reference_requests', 'signed_documents',
    'rejection_templates', 'invitations', 'audit_logs', 'integration_events'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_platform_admin', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
        t || '_platform_admin', t
      );
    end if;
  end loop;
end $$;
