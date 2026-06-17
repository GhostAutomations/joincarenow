-- ============================================================
-- JOIN CARE NOW — Migration 0046: per-application form status counts
-- Powers the small forms indicator on each pipeline card:
--   awaiting = forms submitted/pending review (amber)
--   resent   = forms sent back to the applicant, not yet redone (red)
--   total    = all forms attached to the application
-- A card with total > 0 and awaiting = 0 and resent = 0 means all complete (green).
-- "Forms" = workflow form tasks + the application form. Deduped per form,
-- taking the most urgent status (resent > awaiting > approved).
-- Run AFTER 0045_application_form_review_rpc.sql.
-- ============================================================

create or replace function public.get_application_form_status()
returns table (application_id uuid, awaiting int, resent int, total int)
language sql security definer stable set search_path = public
as $$
  with my_companies as (
    select company_id from public.company_users where user_id = auth.uid()
  ),
  forms as (
    -- Workflow form tasks
    select ot.application_id, ot.form_id,
           case ot.status::text
             when 'approved' then 'approved'
             when 'rejected' then 'rejected'
             else 'awaiting'
           end as st
    from public.onboarding_tasks ot
    where ot.task_type = 'form'
      and ot.company_id in (select company_id from my_companies)

    union all

    -- The application form (the form assigned to the job)
    select fs.application_id, fs.form_id,
           case coalesce(fs.review_status, 'submitted')
             when 'approved' then 'approved'
             when 'rejected' then 'rejected'
             else 'awaiting'
           end as st
    from public.form_submissions fs
    join public.applications a on a.id = fs.application_id
    join public.jobs j on j.id = a.job_id
    where fs.form_id = j.application_form_id
      and fs.company_id in (select company_id from my_companies)
  ),
  dedup as (
    select distinct on (application_id, form_id) application_id, st
    from forms
    order by application_id, form_id,
      case st when 'rejected' then 0 when 'awaiting' then 1 else 2 end
  )
  select application_id,
         count(*) filter (where st = 'awaiting')::int as awaiting,
         count(*) filter (where st = 'rejected')::int as resent,
         count(*)::int as total
  from dedup
  group by application_id;
$$;
