-- ============================================================
-- JOIN CARE NOW — Migration 0130: Job description library
-- Reusable job descriptions, managed like contract templates / policy documents.
-- A job links to one job description (jobs.job_description_id); the advert shows
-- the linked description live, so editing the description updates every job that
-- uses it. Run AFTER 0129_workflow_role_set.sql.
-- ============================================================

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  body text not null default '',
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);
create index if not exists idx_job_descriptions_company on public.job_descriptions (company_id);
drop trigger if exists trg_job_descriptions_updated on public.job_descriptions;
create trigger trg_job_descriptions_updated before update on public.job_descriptions
  for each row execute function public.set_updated_at();

alter table public.job_descriptions enable row level security;
drop policy if exists job_descriptions_select on public.job_descriptions;
create policy job_descriptions_select on public.job_descriptions
  for select using (public.is_company_member(company_id));
drop policy if exists job_descriptions_insert on public.job_descriptions;
create policy job_descriptions_insert on public.job_descriptions
  for insert with check (public.is_company_admin(company_id));
drop policy if exists job_descriptions_update on public.job_descriptions;
create policy job_descriptions_update on public.job_descriptions
  for update using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
drop policy if exists job_descriptions_delete on public.job_descriptions;
create policy job_descriptions_delete on public.job_descriptions
  for delete using (public.is_company_admin(company_id));

alter table public.jobs
  add column if not exists job_description_id uuid
    references public.job_descriptions (id) on delete set null;

-- The public advert shows the LINKED job description live (falling back to any
-- legacy free-text description). SECURITY DEFINER, so it reads the linked
-- description regardless of RLS. Same signature as before (grants preserved).
create or replace function public.get_public_job(p_company_slug text, p_job_slug text)
returns table (
  company_id uuid, company_name text, company_slug text,
  job_id uuid, job_slug text, title text, description text,
  location text, employment_type text, salary text,
  vacancies int, closing_date date, created_at timestamptz
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name, c.slug, j.id, j.slug, j.title,
         coalesce(nullif(jd.body, ''), j.description),
         coalesce(b.name, j.location), j.employment_type, j.salary,
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
