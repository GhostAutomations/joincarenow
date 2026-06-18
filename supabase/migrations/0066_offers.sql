-- ============================================================
-- JOIN CARE NOW — Migration 0066: Offers
-- Moving an applicant to Offer creates an offer (start date, role, pay, hours,
-- conditional + conditions, message). The applicant accepts/declines via a
-- secure no-login link, like interviews. Run AFTER 0065_request_cv_links_to_application.sql.
-- ============================================================

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  role text,
  start_date date,
  pay text,
  hours text,
  conditional boolean not null default false,
  conditions text,
  message text,
  token uuid not null default gen_random_uuid(),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  sent_at timestamptz default now(),
  responded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_offers_token on public.offers (token);
create index if not exists idx_offers_application on public.offers (application_id);
create index if not exists idx_offers_company on public.offers (company_id);

create trigger trg_offers_updated before update on public.offers
  for each row execute function public.set_updated_at();

alter table public.offers enable row level security;

create policy offers_select_company on public.offers
  for select using (public.is_company_member(company_id));
create policy offers_insert_company on public.offers
  for insert with check (public.is_company_member(company_id));
create policy offers_update_company on public.offers
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy offers_select_applicant on public.offers
  for select using (public.is_applicant_owner(applicant_id));

-- ---------- Public: fetch / respond by token (no login) ----------
create or replace function public.get_offer_by_token(p_token uuid)
returns table (
  offer_id uuid, status text, role text, start_date date, pay text, hours text,
  conditional boolean, conditions text, message text,
  company_name text, job_title text, first_name text
)
language sql security definer stable set search_path = public
as $$
  select o.id, o.status, o.role, o.start_date, o.pay, o.hours, o.conditional, o.conditions, o.message,
         c.name, j.title, ap.first_name
  from public.offers o
  join public.companies c on c.id = o.company_id
  left join public.applications a on a.id = o.application_id
  left join public.jobs j on j.id = a.job_id
  left join public.applicants ap on ap.id = o.applicant_id
  where o.token = p_token;
$$;

create or replace function public.respond_to_offer_by_token(p_token uuid, p_response text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_company_id uuid; v_status text;
begin
  if p_response not in ('accepted', 'declined') then raise exception 'Invalid response'; end if;
  select id, company_id, status into v_id, v_company_id, v_status
  from public.offers where token = p_token;
  if v_id is null then raise exception 'Offer not found'; end if;
  if v_status <> 'sent' then raise exception 'This offer has already been responded to'; end if;

  update public.offers
  set status = p_response, responded_at = now()
  where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'offer.' || p_response, 'offer', v_id, jsonb_build_object('via', 'token'));
end;
$$;

grant execute on function public.get_offer_by_token(uuid) to anon, authenticated;
grant execute on function public.respond_to_offer_by_token(uuid, text) to anon, authenticated;
