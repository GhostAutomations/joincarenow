-- ============================================================
-- JOIN CARE NOW — Migration 0067: applicant's offers in the portal
-- So the applicant can accept/decline from their portal (not only the email link).
-- Run AFTER 0066_offers.sql.
-- ============================================================

create or replace function public.get_my_offers()
returns table (
  token uuid, status text, role text, start_date date, pay text, hours text,
  conditional boolean, conditions text, message text, company_name text, job_title text
)
language sql security definer stable set search_path = public
as $$
  select o.token, o.status, o.role, o.start_date, o.pay, o.hours, o.conditional, o.conditions,
         o.message, c.name, j.title
  from public.offers o
  join public.applicants ap on ap.id = o.applicant_id
  join public.companies c on c.id = o.company_id
  left join public.applications a on a.id = o.application_id
  left join public.jobs j on j.id = a.job_id
  where ap.user_id = auth.uid()
  order by o.created_at desc;
$$;
