-- ============================================================
-- JOIN CARE NOW — Migration 0071: decline reason + talent-pool opt-in
-- When an applicant declines an offer, let them optionally say why AND choose to
-- be kept in the company's talent pool for future roles (GDPR consent captured
-- with a timestamp). Store the reason on the offer; record consent on the
-- applicant. Replaces the 2-arg respond_to_offer_by_token with a version that
-- also takes a reason + talent-pool flag. Run AFTER 0070_realtime_offers.sql.
-- ============================================================

alter table public.offers add column if not exists decline_reason text;

-- Talent-pool consent lives on the applicant (it's applicant-level, reused across roles).
alter table public.applicants add column if not exists talent_pool boolean not null default false;
alter table public.applicants add column if not exists talent_pool_consent_at timestamptz;

drop function if exists public.respond_to_offer_by_token(uuid, text);

create or replace function public.respond_to_offer_by_token(
  p_token uuid, p_response text, p_reason text default null, p_talent_pool boolean default false
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_application_id uuid; v_applicant_id uuid; v_status text;
  v_reason text;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  select o.id, o.company_id, o.application_id, a.applicant_id, o.status
    into v_id, v_company_id, v_application_id, v_applicant_id, v_status
  from public.offers o
  join public.applications a on a.id = o.application_id
  where o.token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  v_reason := case when p_response = 'declined' then nullif(btrim(coalesce(p_reason, '')), '') else null end;

  update public.offers
  set status = p_response, responded_at = now(), decline_reason = v_reason
  where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.' || p_response, 'offer', v_id,
          jsonb_build_object('via', 'token', 'reason', v_reason, 'talent_pool', p_talent_pool));

  -- On acceptance, move to Hired and create the employee record.
  if p_response = 'accepted' then
    update public.applications
    set stage = 'hired', hired_at = coalesce(hired_at, now())
    where id = v_application_id and stage <> 'hired';
    perform public._create_employee_internal(v_application_id);

  -- On decline, record talent-pool consent if they opted in.
  elsif p_response = 'declined' and p_talent_pool then
    update public.applicants
    set talent_pool = true, talent_pool_consent_at = now()
    where id = v_applicant_id;
  end if;
end;
$$;

grant execute on function public.respond_to_offer_by_token(uuid, text, text, boolean) to anon, authenticated;
