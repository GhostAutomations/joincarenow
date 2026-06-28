-- ============================================================
-- JOIN CARE NOW — Migration 0131: Mileage rate
-- A per-mile mileage rate (stored as a plain number, displayed with "p") on
-- jobs (shown on the advert) and carried onto the offer (so it can appear on
-- the contract via the {{mileage}} merge field). Run AFTER 0130, then `ship`.
-- ============================================================

alter table public.jobs   add column if not exists mileage text;
alter table public.offers add column if not exists mileage text;

-- get_public_job now also returns mileage (return signature changes, so drop
-- + recreate, then re-grant).
drop function if exists public.get_public_job(text, text);
create function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, description text,
  location text, employment_type text, salary text, mileage text,
  vacancies int, closing_date date, created_at timestamptz
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title,
         coalesce(nullif(jd.body, ''), j.description),
         coalesce(b.name, j.location), j.employment_type, j.salary, j.mileage,
         j.vacancies, j.closing_date, j.created_at
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.branches b on b.id = j.branch_id
  left join public.job_descriptions jd on jd.id = j.job_description_id
  where c.slug = p_company_slug
    and j.slug = p_job_slug
    and j.status = 'published'
    and (
      (j.closing_date is not null and j.closing_date >= current_date)
      or (j.closing_date is null and j.created_at >= now() - interval '30 days')
    );
$$;
grant execute on function public.get_public_job(text, text) to anon, authenticated;

-- The signable-offer RPC now returns mileage too, so the contract's {{mileage}}
-- merge field can be filled. Return signature changes, so drop + recreate + grant.
drop function if exists public.get_offer_by_token(uuid);
create function public.get_offer_by_token(p_token uuid)
returns table (
  offer_id uuid, status text, role text, start_date date, pay text, hours text, mileage text,
  conditional boolean, conditions text, message text,
  company_name text, job_title text, first_name text, last_name text,
  contract_id uuid, contract_name text, contract_body text, contract_version int,
  contract_sig_method text, policies jsonb
)
language sql security definer stable set search_path = public
as $$
  select o.id, o.status, o.role, o.start_date, o.pay, o.hours, o.mileage, o.conditional, o.conditions, o.message,
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
