-- ============================================================
-- JOIN CARE NOW — Migration 0156: public jobs feed (aggregators)
-- Full details for every published, live job across all companies, for an
-- XML feed that job aggregators (Adzuna, Jooble, Talent.com) pull. Mirrors the
-- published/not-expired logic of get_public_job_urls. A company can opt out by
-- setting settings->>'no_job_feed' = 'true' (default: included). Run AFTER 0155.
-- ============================================================

create or replace function public.get_public_jobs_feed()
returns table (
  company_name text, company_slug text, company_logo text,
  job_slug text, job_id uuid, title text, description text,
  employment_type text, salary text,
  city text, region text, postcode text,
  created_at timestamptz, closing_date date
)
language sql security definer stable set search_path = public
as $$
  select c.name, c.slug, (c.settings->'brand'->>'logo_url'),
         j.slug, j.id, j.title,
         coalesce(nullif(jd.body, ''), j.description),
         j.employment_type, j.salary,
         coalesce(b.city, b.name, j.location), b.region, b.postcode,
         j.created_at, j.closing_date
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.branches b on b.id = j.branch_id
  left join public.job_descriptions jd on jd.id = j.job_description_id
  where j.status = 'published'
    and coalesce(c.settings->>'no_job_feed', '') <> 'true'
    and (
      (j.closing_date is not null and j.closing_date >= current_date)
      or (j.closing_date is null and j.created_at >= now() - interval '30 days')
    );
$$;
grant execute on function public.get_public_jobs_feed() to anon, authenticated;
