-- ============================================================
-- JOIN CARE NOW — Migration 0153: GDPR erasure (right to be forgotten)
-- Company-scoped hard delete of everything JCN holds about an applicant AT ONE
-- company. The applicant is a shared, cross-company profile, so we only ever
-- delete this company's data; the shared profile is removed only if the person
-- has no applications left at any company (fully orphaned). Storage objects are
-- not reachable from SQL, so we return their paths for the caller to delete.
--
-- Used by the Data & Privacy erase action and the retention cron. Admin-guarded
-- (company admin or platform admin). Run AFTER 0152.
-- ============================================================

create or replace function public.erase_applicant_at_company(p_company_id uuid, p_applicant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app_ids uuid[];
  v_app_paths text[] := '{}';
  v_hr_paths text[] := '{}';
  v_user_id uuid;
  v_orphaned boolean := false;
begin
  -- Company admin or founder from the app; or the service role from the
  -- retention cron (server-only, no session, so is_company_admin is false).
  if not (
    public.is_company_admin(p_company_id)
    or public.is_platform_admin()
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  ) then
    raise exception 'Not allowed';
  end if;

  select array_agg(id) into v_app_ids
  from public.applications
  where company_id = p_company_id and applicant_id = p_applicant_id;

  -- Collect private storage paths (applications bucket) before deleting the rows.
  if v_app_ids is not null then
    select coalesce(array_agg(p), '{}') into v_app_paths
    from (
      select unnest(array[cv_path, rtw_doc_path]) as p
        from public.applications where id = any(v_app_ids)
      union all
      select unnest(array[doc_path, doc_path_back])
        from public.onboarding_tasks where application_id = any(v_app_ids)
    ) s
    where p is not null and btrim(p) <> '';
  end if;

  -- HR document paths (hr-documents bucket) for any employee record.
  select coalesce(array_agg(ed.file_path), '{}') into v_hr_paths
  from public.employee_documents ed
  join public.employees e on e.id = ed.employee_id
  where e.company_id = p_company_id and e.applicant_id = p_applicant_id
    and ed.file_path is not null;

  select user_id into v_user_id from public.applicants where id = p_applicant_id;

  -- Delete company-scoped rows. Employees first (cascades employee_absences /
  -- warnings / documents / integration_events via employee_id).
  delete from public.employees where company_id = p_company_id and applicant_id = p_applicant_id;
  if v_app_ids is not null then
    delete from public.staff_messages where application_id = any(v_app_ids);
  end if;
  delete from public.messages where company_id = p_company_id and applicant_id = p_applicant_id;
  delete from public.signed_documents where company_id = p_company_id and applicant_id = p_applicant_id;
  -- Deleting the applications cascades interviews, offers, form_submissions,
  -- reference_requests, onboarding_tasks, ruby_reports, credits, etc.
  delete from public.applications where company_id = p_company_id and applicant_id = p_applicant_id;

  -- Remove the shared applicant profile only if nothing references it anywhere.
  if not exists (select 1 from public.applications where applicant_id = p_applicant_id) then
    delete from public.applicants where id = p_applicant_id;
    v_orphaned := true;
  end if;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (
    p_company_id, 'data_privacy.applicant_erased', 'applicant', p_applicant_id,
    jsonb_build_object(
      'applications_removed', coalesce(array_length(v_app_ids, 1), 0),
      'profile_deleted', v_orphaned
    )
  );

  return jsonb_build_object(
    'storage_applications', to_jsonb(v_app_paths),
    'storage_hr', to_jsonb(v_hr_paths),
    'user_id', v_user_id,
    'orphaned', v_orphaned
  );
end;
$function$;

grant execute on function public.erase_applicant_at_company(uuid, uuid) to authenticated;
