-- ============================================================
-- JOIN CARE NOW — Migration 0119: Google for Jobs support
-- 1) get_public_job now returns created_at (datePosted) and only returns a job
--    while it is genuinely OPEN: published AND not past its closing date (jobs
--    with no closing date are considered open for 30 days after posting). This
--    means closed/expired jobs return no row, so the public page can 404.
-- 2) get_public_job_urls() lists every currently-open public job for the XML
--    sitemap. Both SECURITY DEFINER + public-safe (no private columns).
-- Run AFTER 0118_notification_prefs.sql.
-- ============================================================

-- "Open for the public / Google" predicate, kept consistent across the RPCs.
-- (Inlined in SQL below rather than a helper to keep it a single stable function.)

drop function if exists public.get_public_job(text, text);
create or replace function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, description text,
  location text, employment_type text, salary text,
  vacancies int, closing_date date, created_at timestamptz
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title, j.description,
         coalesce(b.name, j.location), j.employment_type, j.salary,
         j.vacancies, j.closing_date, j.created_at
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.branches b on b.id = j.branch_id
  where c.slug = p_company_slug
    and j.slug = p_job_slug
    and j.status = 'published'
    and (
      (j.closing_date is not null and j.closing_date >= current_date)
      or (j.closing_date is null and j.created_at >= now() - interval '30 days')
    );
$$;

-- Sitemap feed: all currently-open public jobs (company + job slug + lastmod).
create or replace function public.get_public_job_urls()
returns table (company_slug text, job_slug text, last_modified timestamptz)
language sql security definer stable set search_path = public
as $$
  select c.slug, j.slug, j.created_at
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.status = 'published'
    and (
      (j.closing_date is not null and j.closing_date >= current_date)
      or (j.closing_date is null and j.created_at >= now() - interval '30 days')
    );
$$;

grant execute on function public.get_public_job_urls() to anon, authenticated;
