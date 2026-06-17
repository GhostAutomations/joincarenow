-- ============================================================
-- JOIN CARE NOW — Migration 0043: allow re-submitting a resent form
-- When a recruiter resends a form, the applicant edits and submits again.
-- The old function INSERTed a new submission, violating the unique
-- (application_id, form_id) constraint. Now it upserts: updates the existing
-- submission's answers and resets its review status to 'submitted'.
-- Run AFTER 0042_application_form_review.sql.
-- ============================================================

create or replace function public.submit_onboarding_form(p_task_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.onboarding_tasks;
  v_owner boolean;
  v_submission_id uuid;
begin
  select * into v_task from public.onboarding_tasks where id = p_task_id;
  if v_task.id is null or v_task.form_id is null then raise exception 'Task not found'; end if;
  select exists (select 1 from public.applicants where id = v_task.applicant_id and user_id = auth.uid())
    into v_owner;
  if not v_owner then raise exception 'Not allowed'; end if;

  insert into public.form_submissions (company_id, form_id, application_id, applicant_id, answers, review_status, review_note)
  values (v_task.company_id, v_task.form_id, v_task.application_id, v_task.applicant_id,
          coalesce(p_answers, '{}'::jsonb), 'submitted', null)
  on conflict (application_id, form_id) do update
    set answers = excluded.answers,
        review_status = 'submitted',
        review_note = null
  returning id into v_submission_id;

  update public.onboarding_tasks
  set status = 'submitted', submission_id = v_submission_id, note = null
  where id = p_task_id;
end;
$$;
