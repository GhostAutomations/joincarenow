-- ============================================================
-- JOIN CARE NOW — Migration 0146: expose a document's signature method to the
-- onboarding read-&-sign flow, so a document marked "signature not required"
-- ('none') is presented as read-&-confirm (no signature capture). Run AFTER 0145.
-- ============================================================

drop function if exists public.get_onboarding_document(uuid);
create or replace function public.get_onboarding_document(p_task_id uuid)
returns table(title text, body text, kind text, source_id uuid, version int,
              already_signed boolean, signature_method text)
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
                     where sd.application_id = v_app and sd.source_id = ct.id and sd.review_status <> 'rejected'),
             coalesce(ct.signature_method, 'type')
      from public.contract_templates ct where ct.id = v_doc;
  else
    return query
      select pd.name, public._merge_doc_body(v_app, pd.body), 'policy'::text, pd.id, pd.version,
             exists (select 1 from public.signed_documents sd
                     where sd.application_id = v_app and sd.source_id = pd.id and sd.review_status <> 'rejected'),
             coalesce(pd.signature_method, 'type')
      from public.policy_documents pd where pd.id = v_doc;
  end if;
end;
$function$;
grant execute on function public.get_onboarding_document(uuid) to authenticated;
