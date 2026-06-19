-- ============================================================
-- JOIN CARE NOW — Migration 0074: sign contract + policies on offer accept
-- The offer carries the job's contract template + policies. When the applicant
-- accepts, they type their name and tick to agree; we snapshot the exact text
-- they agreed to into signed_documents, then complete the hire. Run AFTER
-- 0073_contracts_policies.sql (and the 0068-0072 offer migrations).
-- ============================================================

-- Offer carries which contract + policies to sign (snapshot of the job's set at
-- send time, so later job edits don't change an issued offer).
alter table public.offers
  add column if not exists contract_template_id uuid
    references public.contract_templates (id) on delete set null;

create table if not exists public.offer_policies (
  offer_id uuid not null references public.offers (id) on delete cascade,
  policy_id uuid not null references public.policy_documents (id) on delete cascade,
  primary key (offer_id, policy_id)
);
create index if not exists idx_offer_policies_offer on public.offer_policies (offer_id);

alter table public.offer_policies enable row level security;
drop policy if exists offer_policies_select on public.offer_policies;
create policy offer_policies_select on public.offer_policies
  for select using (exists (
    select 1 from public.offers o
    where o.id = offer_id and (public.is_company_member(o.company_id) or public.is_applicant_owner(o.applicant_id))
  ));
drop policy if exists offer_policies_write on public.offer_policies;
create policy offer_policies_write on public.offer_policies
  for all using (exists (
    select 1 from public.offers o where o.id = offer_id and public.is_company_member(o.company_id)
  ))
  with check (exists (
    select 1 from public.offers o where o.id = offer_id and public.is_company_member(o.company_id)
  ));

-- Immutable record of exactly what was signed, by whom, when.
create table if not exists public.signed_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  applicant_id uuid references public.applicants (id) on delete set null,
  doc_type text not null check (doc_type in ('contract', 'policy')),
  source_id uuid,                 -- contract_templates.id / policy_documents.id (kept even if source later deleted)
  title text not null,
  body_snapshot text not null,    -- the exact, merge-filled text the signer agreed to
  version int,
  signer_name text not null,
  signed_at timestamptz not null default now(),
  signer_ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_signed_documents_application on public.signed_documents (application_id);
create index if not exists idx_signed_documents_company on public.signed_documents (company_id);

alter table public.signed_documents enable row level security;
-- Reads: company members, or the applicant who signed. Writes happen only via the
-- SECURITY DEFINER RPC below (no insert policy needed).
drop policy if exists signed_documents_select_company on public.signed_documents;
create policy signed_documents_select_company on public.signed_documents
  for select using (public.is_company_member(company_id));
drop policy if exists signed_documents_select_applicant on public.signed_documents;
create policy signed_documents_select_applicant on public.signed_documents
  for select using (public.is_applicant_owner(applicant_id));

-- ---------- Public token RPC: now also returns the docs to sign ----------
drop function if exists public.get_offer_by_token(uuid);
create or replace function public.get_offer_by_token(p_token uuid)
returns table (
  offer_id uuid, status text, role text, start_date date, pay text, hours text,
  conditional boolean, conditions text, message text,
  company_name text, job_title text, first_name text, last_name text,
  contract_id uuid, contract_name text, contract_body text, contract_version int,
  policies jsonb
)
language sql security definer stable set search_path = public
as $$
  select o.id, o.status, o.role, o.start_date, o.pay, o.hours, o.conditional, o.conditions, o.message,
         c.name, j.title, ap.first_name, ap.last_name,
         ct.id, ct.name, ct.body, ct.version,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', pd.id, 'name', pd.name, 'body', pd.body, 'version', pd.version)
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

-- ---------- Sign + accept (records signatures, then hires) ----------
-- p_docs: jsonb array of { doc_type, source_id, title, body, version }.
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
  perform public._create_employee_internal(v_application_id);
end;
$$;
grant execute on function public.sign_and_accept_offer(uuid, text, jsonb, text) to anon, authenticated;
