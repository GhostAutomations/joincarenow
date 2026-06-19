-- ============================================================
-- JOIN CARE NOW — Migration 0081: rejection talent-pool opt-in link
-- When an applicant is moved to Not Progressing, the rejection email can include
-- a one-tap link for them to consent to joining the talent pool (6-month
-- retention). Token-secured, no login. Run AFTER 0080_offer_manager.sql.
-- ============================================================

alter table public.applications
  add column if not exists talent_pool_token uuid;
create unique index if not exists idx_applications_tp_token on public.applications (talent_pool_token);

-- Public: what to show on the talent-pool opt-in page.
create or replace function public.get_talent_pool_invite(p_token uuid)
returns table (company_name text, first_name text, opted boolean)
language sql security definer stable set search_path = public
as $$
  select c.name, ap.first_name, coalesce(ap.talent_pool, false)
  from public.applications a
  join public.companies c on c.id = a.company_id
  join public.applicants ap on ap.id = a.applicant_id
  where a.talent_pool_token = p_token;
$$;
grant execute on function public.get_talent_pool_invite(uuid) to anon, authenticated;

-- Public: record the applicant's talent-pool consent via the token.
create or replace function public.consent_talent_pool_by_token(p_token uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_company_id uuid; v_applicant_id uuid;
begin
  select a.company_id, a.applicant_id into v_company_id, v_applicant_id
  from public.applications a where a.talent_pool_token = p_token;
  if v_applicant_id is null then raise exception 'Link not found'; end if;

  update public.applicants
  set talent_pool = true, talent_pool_consent_at = now()
  where id = v_applicant_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'talent_pool.opt_in', 'applicant', v_applicant_id, jsonb_build_object('via', 'rejection_link'));
end;
$$;
grant execute on function public.consent_talent_pool_by_token(uuid) to anon, authenticated;
