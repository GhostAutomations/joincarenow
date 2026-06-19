-- ============================================================
-- JOIN CARE NOW — Migration 0075: instant board update on sign+accept
-- sign_and_accept_offer updates offers + (conditionally) applications.stage. If
-- the applicant was already hired the stage update matched no rows, so the
-- applications realtime event didn't fire. Always touch applications.updated_at
-- so the pipeline board refreshes immediately, matching the simple-accept path.
-- Run AFTER 0074_offer_signing.sql.
-- ============================================================

create or replace function public.sign_and_accept_offer(
  p_token uuid, p_signer_name text, p_docs jsonb, p_ip text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_application_id uuid; v_applicant_id uuid; v_status text;
  v_doc jsonb;
begin
  if coalesce(btrim(p_signer_name), '') = '' then raise exception 'A signature (full name) is required'; end if;

  select o.id, o.company_id, o.application_id, o.applicant_id, o.status
    into v_id, v_company_id, v_application_id, v_applicant_id, v_status
  from public.offers o where o.token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  for v_doc in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    insert into public.signed_documents
      (company_id, application_id, offer_id, applicant_id, doc_type, source_id, title, body_snapshot, version, signer_name, signer_ip)
    values
      (v_company_id, v_application_id, v_id, v_applicant_id,
       v_doc->>'doc_type', nullif(v_doc->>'source_id', '')::uuid, v_doc->>'title',
       v_doc->>'body', nullif(v_doc->>'version', '')::int, btrim(p_signer_name), p_ip);
  end loop;

  update public.offers set status = 'accepted', responded_at = now() where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.accepted', 'offer', v_id,
          jsonb_build_object('via', 'token', 'signed', true, 'signer', btrim(p_signer_name)));

  update public.applications
  set stage = 'hired', hired_at = coalesce(hired_at, now())
  where id = v_application_id and stage <> 'hired';
  -- Always emit an applications change so the board's realtime pushes instantly.
  update public.applications set updated_at = now() where id = v_application_id;

  perform public._create_employee_internal(v_application_id);
end;
$$;
grant execute on function public.sign_and_accept_offer(uuid, text, jsonb, text) to anon, authenticated;
