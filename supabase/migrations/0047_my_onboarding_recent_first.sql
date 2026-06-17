-- ============================================================
-- JOIN CARE NOW — Migration 0047: portal tasks, most recent first
-- Applicants should see the most recently issued / reissued (resent) forms at
-- the top of "Your tasks". updated_at is bumped on every status change by the
-- existing trigger, so ordering by it surfaces newly sent and resent forms.
-- Run AFTER 0046_application_form_status_counts.sql.
-- ============================================================

create or replace function public.get_my_onboarding()
returns table (
  task_id uuid, title text, task_type public.onboarding_task_type, status public.onboarding_status,
  body text, form_id uuid, due_date date, company_name text, note text
)
language sql security definer stable set search_path = public
as $$
  select ot.id, ot.title, ot.task_type, ot.status, ot.body, ot.form_id, ot.due_date, c.name, ot.note
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  join public.companies c on c.id = ot.company_id
  where ap.user_id = auth.uid()
  order by ot.updated_at desc, ot.created_at desc;
$$;
