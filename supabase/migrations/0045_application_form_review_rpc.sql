-- ============================================================
-- JOIN CARE NOW — Migration 0045: application-form review + resend
-- Two bugs this fixes:
--  (1) Approving the application form didn't persist — the staff action did a
--      direct UPDATE on form_submissions, which RLS blocks (no company UPDATE
--      policy), so on reopen it reverted to "Submitted". We now go through a
--      SECURITY DEFINER RPC that updates the review status reliably.
--  (2) Resending the application form gave the applicant nowhere to redo it.
--      On resend we now create (or reuse) an onboarding "form" task pointing at
--      the application form, so it appears in the applicant portal pre-filled
--      with their previous answers, just like any other resent form.
-- Run AFTER 0044_get_onboarding_form_answers.sql.
-- ============================================================

create or replace function public.set_application_form_review(
  p_application_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_form_id uuid;
  v_task_id uuid;
  v_pos int;
begin
  if p_status not in ('approved', 'rejected', 'submitted') then
    raise exception 'Invalid status';
  end if;

  select a.company_id, a.applicant_id, j.application_form_id
    into v_company_id, v_applicant_id, v_form_id
  from public.applications a
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;
  if v_form_id is null then raise exception 'No application form assigned'; end if;

  -- Persist the review on the submission (the recruiter-facing status).
  update public.form_submissions
  set review_status = p_status,
      review_note = p_note
  where application_id = p_application_id and form_id = v_form_id;

  -- On resend, surface the form to the applicant as a portal task so they can
  -- edit and resubmit. Reuse an existing task for this form if there is one.
  if p_status = 'rejected' then
    select id into v_task_id
    from public.onboarding_tasks
    where application_id = p_application_id and form_id = v_form_id
    limit 1;

    if v_task_id is null then
      select coalesce(max(position), 0) + 1 into v_pos
      from public.onboarding_tasks where application_id = p_application_id;

      insert into public.onboarding_tasks
        (company_id, application_id, applicant_id, title, task_type, form_id,
         required, status, note, position)
      values
        (v_company_id, p_application_id, v_applicant_id, 'Application form', 'form', v_form_id,
         true, 'rejected', p_note, v_pos);
    else
      update public.onboarding_tasks
      set status = 'rejected', note = p_note
      where id = v_task_id;
    end if;
  elsif p_status = 'approved' then
    -- Keep any matching portal task in sync.
    update public.onboarding_tasks
    set status = 'approved', note = null
    where application_id = p_application_id and form_id = v_form_id;
  end if;
end;
$$;
