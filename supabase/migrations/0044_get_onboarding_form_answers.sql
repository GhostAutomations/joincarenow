-- ============================================================
-- JOIN CARE NOW — Migration 0044: pre-fill a resent form
-- When a recruiter resends a form, the applicant should see their
-- previously-submitted answers so they can edit/add. This returns the
-- existing submission's answers for a task, scoped to the owning applicant.
-- Run AFTER 0043_resubmit_onboarding_form.sql.
-- ============================================================

create or replace function public.get_onboarding_form_answers(p_task_id uuid)
returns jsonb
language sql security definer stable set search_path = public
as $$
  select coalesce(fs.answers, '{}'::jsonb)
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  left join public.form_submissions fs
    on fs.application_id = ot.application_id and fs.form_id = ot.form_id
  where ot.id = p_task_id and ap.user_id = auth.uid()
  limit 1;
$$;
