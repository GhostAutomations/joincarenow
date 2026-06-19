-- ============================================================
-- JOIN CARE NOW — Migration 0080: capture the manager on the offer
-- The employee record (and Carer.Academy payload) has a manager, but it was
-- never asked for. Capture it on the offer; on accept, set it on the new
-- employee. Run AFTER 0079_offer_start_date_to_application.sql.
-- ============================================================

alter table public.offers
  add column if not exists manager_id uuid references public.profiles (id) on delete set null;

-- Simple accept / decline.
create or replace function public.respond_to_offer_by_token(
  p_token uuid, p_response text, p_reason text default null, p_talent_pool boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_application_id uuid; v_applicant_id uuid; v_status text;
  v_start_date date; v_manager_id uuid; v_reason text;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  select o.id, o.company_id, o.application_id, a.applicant_id, o.status, o.start_date, o.manager_id
    into v_id, v_company_id, v_application_id, v_applicant_id, v_status, v_start_date, v_manager_id
  from public.offers o
  join public.applications a on a.id = o.application_id
  where o.token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  v_reason := case when p_response = 'declined' then nullif(btrim(coalesce(p_reason, '')), '') else null end;

  update public.offers set status = p_response, responded_at = now(), decline_reason = v_reason where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.' || p_response, 'offer', v_id,
          jsonb_build_object('via', 'token', 'reason', v_reason, 'talent_pool', p_talent_pool));

  if p_response = 'accepted' then
    update public.applications
    set stage = 'hired', hired_at = coalesce(hired_at, now()), start_date = coalesce(v_start_date, start_date)
    where id = v_application_id and stage <> 'hired';
    update public.applications set updated_at = now() where id = v_application_id;
    perform public._create_employee_internal(v_application_id);
    if v_manager_id is not null then
      update public.employees set manager_id = v_manager_id where application_id = v_application_id;
    end if;
  elsif p_response = 'declined' then
    if p_talent_pool then
      update public.applicants set talent_pool = true, talent_pool_consent_at = now() where id = v_applicant_id;
    end if;
    update public.applications set updated_at = now() where id = v_application_id;
  end if;
end;
$$;
grant execute on function public.respond_to_offer_by_token(uuid, text, text, boolean) to anon, authenticated;

-- Sign-and-accept.
create or replace function public.sign_and_accept_offer(
  p_token uuid, p_signer_name text, p_docs jsonb, p_ip text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_application_id uuid; v_applicant_id uuid; v_status text;
  v_start_date date; v_manager_id uuid; v_doc jsonb;
begin
  if coalesce(btrim(p_signer_name), '') = '' then raise exception 'A signature is required'; end if;

  select o.id, o.company_id, o.application_id, o.applicant_id, o.status, o.start_date, o.manager_id
    into v_id, v_company_id, v_application_id, v_applicant_id, v_status, v_start_date, v_manager_id
  from public.offers o where o.token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  for v_doc in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    insert into public.signed_documents
      (company_id, application_id, offer_id, applicant_id, doc_type, source_id, title,
       body_snapshot, version, signer_name, signer_ip, signature_method, signature_image)
    values
      (v_company_id, v_application_id, v_id, v_applicant_id,
       v_doc->>'doc_type', nullif(v_doc->>'source_id', '')::uuid, v_doc->>'title',
       v_doc->>'body', nullif(v_doc->>'version', '')::int,
       btrim(coalesce(v_doc->>'signer_name', p_signer_name)), p_ip,
       coalesce(v_doc->>'signature_method', 'type'), nullif(v_doc->>'signature_image', ''));
  end loop;

  update public.offers set status = 'accepted', responded_at = now() where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.accepted', 'offer', v_id,
          jsonb_build_object('via', 'token', 'signed', true, 'signer', btrim(p_signer_name)));

  update public.applications
  set stage = 'hired', hired_at = coalesce(hired_at, now()), start_date = coalesce(v_start_date, start_date)
  where id = v_application_id and stage <> 'hired';
  update public.applications set updated_at = now() where id = v_application_id;

  perform public._create_employee_internal(v_application_id);
  if v_manager_id is not null then
    update public.employees set manager_id = v_manager_id where application_id = v_application_id;
  end if;
end;
$$;
grant execute on function public.sign_and_accept_offer(uuid, text, jsonb, text) to anon, authenticated;
