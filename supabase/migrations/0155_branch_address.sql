-- ============================================================
-- JOIN CARE NOW — Migration 0155: branch address for job structured data
-- A branch (which a job targets) can carry a full area/office address. This
-- flows into the job's JobPosting structured data so streetAddress, addressRegion
-- and postalCode are populated for Google (clearing the optional-field warnings
-- and improving local relevance). All optional. Run AFTER 0154.
-- ============================================================

alter table public.branches
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postcode text;

-- get_public_job now also returns the branch address components. Return signature
-- changes, so drop + recreate + re-grant (verbatim body of 0131 plus the address).
drop function if exists public.get_public_job(text, text);
create function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, description text,
  location text, employment_type text, salary text, mileage text,
  vacancies int, closing_date date, created_at timestamptz,
  loc_street text, loc_city text, loc_region text, loc_postcode text
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title,
         coalesce(nullif(jd.body, ''), j.description),
         coalesce(b.name, j.location), j.employment_type, j.salary, j.mileage,
         j.vacancies, j.closing_date, j.created_at,
         b.address_line, coalesce(b.city, b.name), b.region, b.postcode
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
