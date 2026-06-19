-- ============================================================
-- JOIN CARE NOW — Migration 0076: per-document signature method
-- Admins choose, per contract/policy, how the applicant signs: 'type' (tick +
-- type name) or 'draw' (tick + draw signature). The applicant's name is shown in
-- the signature area either way. Store the typed name and/or drawn image on each
-- signed document. Run AFTER 0075_sign_accept_realtime_touch.sql.
-- ============================================================

alter table public.contract_templates
  add column if not exists signature_method text not null default 'type'
    check (signature_method in ('type', 'draw'));
alter table public.policy_documents
  add column if not exists signature_method text not null default 'type'
    check (signature_method in ('type', 'draw'));

alter table public.signed_documents
  add column if not exists signature_method text not null default 'type',
  add column if not exists signature_image text;  -- data URL of the drawn signature, if 'draw'

-- Token RPC returns the signature method per doc.
drop function if exists public.get_offer_by_token(uuid);
create or replace function public.get_offer_by_token(p_token uuid)
returns table (
  offer_id uuid, status text, role text, start_date date, pay text, hours text,
  conditional boolean, conditions text, message text,
  company_name text, job_title text, first_name text, last_name text,
  contract_id uuid, contract_name text, contract_body text, contract_version int,
  contract_sig_method text, policies jsonb
)
language sql security definer stable set search_path = public
as $$
  select o.id, o.status, o.role, o.start_date, o.pay, o.hours, o.conditional, o.conditions, o.message,
         c.name, j.title, ap.first_name, ap.last_name,
         ct.id, ct.name, ct.body, ct.version, ct.signature_method,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                     'id', pd.id, 'name', pd.name, 'body', pd.body,
                     'version', pd.version, 'signature_method', pd.signature_method)
                            order by pd.name)
           from public.offer_policies op
           join public.policy_documents pd on pd.id = op.policy_id
           where op.offer_id = o.id
         ), '[]'::jsonb)
  from public.offers o
  join public.companies c on c.id = o.company_id
  left join public.applications a on a.id = o.application_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = o.applicant_id
  left join public.contract_templates ct on ct.id = o.contract_template_id
  where o.token = p_token;
$$;
grant execute on function public.get_offer_by_token(uuid) to anon, authenticated;

-- Sign + accept now records the signature method + drawn image per doc.
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
  if coalesce(btrim(p_signer_name), '') = '' then raise exception 'A signature is required'; end if;

  select o.id, o.company_id, o.application_id, o.applicant_id, o.status
    into v_id, v_company_id, v_application_id, v_applicant_id, v_status
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
  set stage = 'hired', hired_at = coalesce(hired_at, now())
  where id = v_application_id and stage <> 'hired';
  update public.applications set updated_at = now() where id = v_application_id;

  perform public._create_employee_internal(v_application_id);
end;
$$;
grant execute on function public.sign_and_accept_offer(uuid, text, jsonb, text) to anon, authenticated;
