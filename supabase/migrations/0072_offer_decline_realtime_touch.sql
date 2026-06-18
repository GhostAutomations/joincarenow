-- ============================================================
-- JOIN CARE NOW — Migration 0072: instant decline on the board
-- Declining only updated the offers row. Accept felt instant because it also
-- updated the applications row (which reliably fires the board's realtime
-- subscription); decline had no applications change so it only refreshed on the
-- 60s poll (~30s). Fix: on decline, touch applications.updated_at so the proven
-- applications channel pushes immediately. Run AFTER 0071_offer_decline_reason.sql.
-- ============================================================

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

  if p_response = 'accepted' then
    update public.applications
    set stage = 'hired', hired_at = coalesce(hired_at, now())
    where id = v_application_id and stage <> 'hired';
    perform public._create_employee_internal(v_application_id);

  elsif p_response = 'declined' then
    if p_talent_pool then
      update public.applicants
      set talent_pool = true, talent_pool_consent_at = now()
      where id = v_applicant_id;
    end if;
    -- Touch the application so the board's realtime subscription pushes instantly.
    update public.applications set updated_at = now() where id = v_application_id;
  end if;
end;
$$;

grant execute on function public.respond_to_offer_by_token(uuid, text, text, boolean) to anon, authenticated;
