-- ============================================================
-- JOIN CARE NOW — Migration 0147: workflow "Uploads" (document requests)
-- The workflow builder gains an Uploads box (DBS, Right to Work, proof of
-- address, etc.). Dropping one on a stage creates a document-upload task tagged
-- with its kind; dropping one in a Poppy box tells Poppy to review that upload.
--  - onboarding_templates.doc_kind: the upload kind for a 'document' task.
--  - onboarding_templates.poppy_upload_kinds: uploads Poppy should review.
--  - create_stage_tasks copies doc_kind onto the applicant's task instance.
-- Run AFTER 0146.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists doc_kind text,
  add column if not exists poppy_upload_kinds text[];

create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_company_id uuid; v_applicant_id uuid; v_role_id uuid;
begin
  select a.company_id, a.applicant_id, coalesce(j.workflow_role_id, j.role_id)
    into v_company_id, v_applicant_id, v_role_id
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
  if v_company_id is null then return; end if;
  if not (public.is_company_member(v_company_id)
    or exists (select 1 from public.applicants ap where ap.id = v_applicant_id and ap.user_id = auth.uid())
  ) then raise exception 'Not allowed'; end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position, document_id, document_kind, doc_kind)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required,
         case when t.due_days is not null then (current_date + t.due_days) else null end,
         t.id, t.position, t.document_id, t.document_kind, t.doc_kind
  from public.onboarding_templates t
  where t.company_id = v_company_id and t.trigger_stage = p_trigger and t.task_type <> 'poppy'
    and ((coalesce(array_length(t.role_ids, 1), 0) = 0 and t.role_id is null)
      or (v_role_id is not null and v_role_id = any (t.role_ids))
      or (v_role_id is not null and t.role_id = v_role_id))
    and not exists (select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id);
end;
$function$;
