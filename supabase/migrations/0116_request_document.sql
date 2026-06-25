-- ============================================================
-- JOIN CARE NOW — Migration 0116: generic "request a document"
-- Lets staff request any document from an applicant (e.g. DBS certificate),
-- not just a CV. Creates a document onboarding task the applicant fulfils in
-- their portal; the existing set_onboarding_doc (0065) handles the upload.
-- doc_kind tags the request (e.g. 'dbs') so the staff file / pipeline can
-- recognise it. Run AFTER 0115_staff_messages.sql.
-- ============================================================

alter table public.onboarding_tasks
  add column if not exists doc_kind text;

-- Generic document request: creates a required 'document' task with the given
-- title + optional kind tag. Mirrors request_cv but parameterised and never an
-- is_cv task (so it doesn't overwrite applications.cv_path).
create or replace function public.request_document(
  p_application_id uuid,
  p_title text,
  p_message text default null,
  p_doc_kind text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_pos int;
  v_id uuid;
  v_title text;
begin
  select company_id, applicant_id into v_company_id, v_applicant_id
  from public.applications where id = p_application_id;
  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then v_title := 'Upload a document'; end if;

  select coalesce(max(position), 0) + 1 into v_pos
  from public.onboarding_tasks where application_id = p_application_id;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, body, required, status, position, is_cv, doc_kind)
  values
    (v_company_id, p_application_id, v_applicant_id, v_title, 'document',
     nullif(trim(coalesce(p_message, '')), ''), true, 'pending', v_pos, false,
     nullif(trim(coalesce(p_doc_kind, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;
