-- ============================================================
-- JOIN CARE NOW — Migration 0054: Request CV from the pipeline
-- Creates a document task on the applicant's portal asking them to upload a CV,
-- with an optional message from the recruiter. Reuses the onboarding document
-- task flow (the portal already supports file upload for document tasks).
-- Run AFTER 0053_reference_form_phone.sql.
-- ============================================================

create or replace function public.request_cv(p_application_id uuid, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_pos int;
  v_id uuid;
begin
  select company_id, applicant_id into v_company_id, v_applicant_id
  from public.applications where id = p_application_id;
  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  select coalesce(max(position), 0) + 1 into v_pos
  from public.onboarding_tasks where application_id = p_application_id;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, body, required, status, position)
  values
    (v_company_id, p_application_id, v_applicant_id, 'Upload your CV', 'document',
     nullif(trim(coalesce(p_message, '')), ''), true, 'pending', v_pos)
  returning id into v_id;

  return v_id;
end;
$$;
