-- ============================================================
-- JOIN CARE NOW — Migration 0144: sign a contract/policy as an onboarding task
-- The new drag-and-drop workflow builder lets you drop a contract or policy onto
-- a pipeline stage. That becomes a "read & sign" onboarding task: the applicant
-- reads the actual document (merge-filled) and signs it. We snapshot exactly what
-- they agreed to into signed_documents (same table + staff sign-off queue as the
-- offer flow), then mark the task approved. Run AFTER 0143_fix_apply_stage_tasks.
-- ============================================================

-- 1. Link a specific document to a template step and its applicant task instance.
alter table public.onboarding_templates
  add column if not exists document_id uuid,
  add column if not exists document_kind text
    check (document_kind is null or document_kind in ('contract', 'policy'));

alter table public.onboarding_tasks
  add column if not exists document_id uuid,
  add column if not exists document_kind text
    check (document_kind is null or document_kind in ('contract', 'policy'));

-- 2. Copy the document link when instantiating tasks at a stage. (Re-defines the
--    0143 body verbatim plus the two document_* columns.)
create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_role_id uuid;
begin
  select a.company_id, a.applicant_id, coalesce(j.workflow_role_id, j.role_id)
    into v_company_id, v_applicant_id, v_role_id
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
  if v_company_id is null then return; end if;

  if not (
    public.is_company_member(v_company_id)
    or exists (
      select 1 from public.applicants ap
      where ap.id = v_applicant_id and ap.user_id = auth.uid()
    )
  ) then
    raise exception 'Not allowed';
  end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position, document_id, document_kind)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required,
         case when t.due_days is not null then (current_date + t.due_days) else null end,
         t.id, t.position, t.document_id, t.document_kind
  from public.onboarding_templates t
  where t.company_id = v_company_id
    and t.trigger_stage = p_trigger
    and t.task_type <> 'poppy'
    and (
      (coalesce(array_length(t.role_ids, 1), 0) = 0 and t.role_id is null)
      or (v_role_id is not null and v_role_id = any (t.role_ids))
      or (v_role_id is not null and t.role_id = v_role_id)
    )
    and not exists (
      select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id
    );
end;
$function$;

-- 3. Expose the document link to the applicant's task list.
drop function if exists public.get_my_onboarding();
create or replace function public.get_my_onboarding()
returns table(task_id uuid, title text, task_type onboarding_task_type, status onboarding_status,
              body text, form_id uuid, due_date date, company_name text, note text,
              document_id uuid, document_kind text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select ot.id, ot.title, ot.task_type, ot.status, ot.body, ot.form_id, ot.due_date, c.name, ot.note,
         ot.document_id, ot.document_kind
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  join public.companies c on c.id = ot.company_id
  where ap.user_id = auth.uid()
  order by ot.updated_at desc, ot.created_at desc;
$function$;

-- 4. Merge-fill helper — resolves the merge fields we can from the application
--    (name, role, company). Unknown fields (pay/start date at pre-offer stages)
--    are left as-is.
create or replace function public._merge_doc_body(p_application_id uuid, p_body text)
returns text
language sql stable
set search_path to 'public'
as $function$
  select replace(replace(replace(replace(replace(replace(replace(
           coalesce(p_body, ''),
           '{{first_name}}', coalesce(ap.first_name, '')),
           '{{last_name}}',  coalesce(ap.last_name, '')),
           '{{name}}',       btrim(coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, ''))),
           '{{full_name}}',  btrim(coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, ''))),
           '{{role}}',       coalesce(j.title, '')),
           '{{company_name}}', coalesce(c.name, '')),
           '{{company}}',    coalesce(c.name, ''))
  from public.applications a
  join public.companies c on c.id = a.company_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = a.applicant_id
  where a.id = p_application_id;
$function$;

-- 5. Applicant reads the document linked to their task (merge-filled). Guarded by
--    task ownership (applicants can't read company docs directly via RLS).
create or replace function public.get_onboarding_document(p_task_id uuid)
returns table(title text, body text, kind text, source_id uuid, version int, already_signed boolean)
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare v_app uuid; v_doc uuid; v_kind text;
begin
  select ot.application_id, ot.document_id, ot.document_kind
    into v_app, v_doc, v_kind
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  where ot.id = p_task_id and ap.user_id = auth.uid();
  if v_app is null then raise exception 'Not allowed'; end if;
  if v_doc is null then raise exception 'No document is linked to this task'; end if;

  if v_kind = 'contract' then
    return query
      select ct.name, public._merge_doc_body(v_app, ct.body), 'contract'::text, ct.id, ct.version,
             exists (select 1 from public.signed_documents sd
                     where sd.application_id = v_app and sd.source_id = ct.id and sd.review_status <> 'rejected')
      from public.contract_templates ct where ct.id = v_doc;
  else
    return query
      select pd.name, public._merge_doc_body(v_app, pd.body), 'policy'::text, pd.id, pd.version,
             exists (select 1 from public.signed_documents sd
                     where sd.application_id = v_app and sd.source_id = pd.id and sd.review_status <> 'rejected')
      from public.policy_documents pd where pd.id = v_doc;
  end if;
end;
$function$;
grant execute on function public.get_onboarding_document(uuid) to authenticated;

-- 6. Applicant signs the linked document. Snapshots the exact merge-filled text
--    into signed_documents (→ staff sign-off queue), then approves the task.
--    Idempotent: a second call on an approved task is a no-op.
create or replace function public.sign_onboarding_document(
  p_task_id uuid, p_signer_name text, p_signature_image text default null, p_ip text default null
)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_app uuid; v_company uuid; v_applicant uuid; v_doc uuid; v_kind text; v_status text;
  v_title text; v_body text; v_ver int; v_method text;
begin
  if coalesce(btrim(p_signer_name), '') = '' then raise exception 'A signature (full name) is required'; end if;

  select ot.application_id, ot.company_id, ot.applicant_id, ot.document_id, ot.document_kind, ot.status
    into v_app, v_company, v_applicant, v_doc, v_kind, v_status
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  where ot.id = p_task_id and ap.user_id = auth.uid();
  if v_app is null then raise exception 'Not allowed'; end if;
  if v_doc is null then raise exception 'No document is linked to this task'; end if;
  if v_status = 'approved' then return; end if; -- already signed off / done

  if v_kind = 'contract' then
    select ct.name, public._merge_doc_body(v_app, ct.body), ct.version into v_title, v_body, v_ver
    from public.contract_templates ct where ct.id = v_doc;
  else
    select pd.name, public._merge_doc_body(v_app, pd.body), pd.version into v_title, v_body, v_ver
    from public.policy_documents pd where pd.id = v_doc;
  end if;
  if v_title is null then raise exception 'The document could not be found'; end if;

  v_method := case when coalesce(btrim(p_signature_image), '') <> '' then 'draw' else 'type' end;

  -- Don't create a duplicate live signature for the same doc on this application.
  if not exists (
    select 1 from public.signed_documents sd
    where sd.application_id = v_app and sd.source_id = v_doc and sd.review_status <> 'rejected'
  ) then
    insert into public.signed_documents
      (company_id, application_id, offer_id, applicant_id, doc_type, source_id, title,
       body_snapshot, version, signer_name, signer_ip, signature_method, signature_image)
    values
      (v_company, v_app, null, v_applicant, v_kind, v_doc, v_title,
       v_body, v_ver, btrim(p_signer_name), p_ip, v_method,
       case when v_method = 'draw' then p_signature_image else null end);
  end if;

  -- The applicant's part is done (matches acknowledge, which also approves).
  -- The signature itself still passes through the staff sign-off queue
  -- (signed_documents.review_status = 'pending') for QA, same as the offer flow.
  update public.onboarding_tasks set status = 'approved', completed_at = now() where id = p_task_id;
end;
$function$;
grant execute on function public.sign_onboarding_document(uuid, text, text, text) to authenticated;
