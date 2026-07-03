-- ============================================================
-- JOIN CARE NOW — Migration 0151: remove an applicant from the Talent Pool
-- Deletes all of an applicant's applications AT THIS COMPANY (the pool is derived
-- from applications). Child rows cascade (forms, interviews, offers, onboarding,
-- Poppy) or are set null (employees, messages, signed docs). The shared applicant
-- profile itself is untouched. Admin/member-guarded. Run AFTER 0150.
-- ============================================================

create or replace function public.remove_applicant_from_pool(p_company_id uuid, p_applicant_id uuid)
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
declare v_removed integer;
begin
  if not (public.is_company_member(p_company_id) or public.is_platform_admin()) then
    raise exception 'Not allowed';
  end if;

  delete from public.applications
   where applicant_id = p_applicant_id and company_id = p_company_id;
  get diagnostics v_removed = row_count;

  if v_removed > 0 then
    insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
    values (p_company_id, 'talent_pool.removed', 'applicant', p_applicant_id,
            jsonb_build_object('applications_removed', v_removed));
  end if;

  return v_removed;
end;
$function$;
grant execute on function public.remove_applicant_from_pool(uuid, uuid) to authenticated;
