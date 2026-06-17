-- ============================================================
-- JOIN CARE NOW — Migration 0057: applicant "Your References" → referee records
-- When an applicant submits the "Your References" form, parse Referee 1 & 2 and
-- create reference_requests so they appear in the Referencing app, ready to send.
-- Referees complete a separate "Reference questionnaire" (the assessment form)
-- via the secure link. Run AFTER 0056_your_references_applicant_facing.sql.
-- ============================================================

-- The questionnaire the REFEREE fills (assessment questions). Separate from the
-- applicant-facing "Your References" form.
create or replace function public.ensure_reference_questionnaire(p_company_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_form_id uuid;
begin
  select id into v_form_id
  from public.forms
  where company_id = p_company_id
    and coalesce(is_store, false) = false
    and purpose = 'reference_questionnaire'
  order by created_at
  limit 1;
  if v_form_id is not null then return v_form_id; end if;

  insert into public.forms (company_id, name, purpose, category)
  values (p_company_id, 'Reference questionnaire', 'reference_questionnaire', 'referencing')
  returning id into v_form_id;

  insert into public.form_fields (form_id, label, field_type, required, options, position)
  values
    (v_form_id, 'In what capacity do you know the applicant?', 'short_text', true, '[]'::jsonb, 1),
    (v_form_id, 'What were the dates of their employment (from – to)?', 'short_text', true, '[]'::jsonb, 2),
    (v_form_id, 'What was their job title / role?', 'short_text', true, '[]'::jsonb, 3),
    (v_form_id, 'How would you rate their reliability and punctuality?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 4),
    (v_form_id, 'How would you rate their care and compassion?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 5),
    (v_form_id, 'Were there any safeguarding or disciplinary concerns?', 'yes_no', true, '[]'::jsonb, 6),
    (v_form_id, 'If yes, please provide details', 'long_text', false, '[]'::jsonb, 7),
    (v_form_id, 'Would you re-employ this person?', 'yes_no', true, '[]'::jsonb, 8),
    (v_form_id, 'Any additional comments', 'long_text', false, '[]'::jsonb, 9);

  return v_form_id;
end;
$$;

-- Submit handler: upsert the submission, then (for the reference form) create
-- reference_requests from the two referees the applicant entered.
create or replace function public.submit_onboarding_form(p_task_id uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.onboarding_tasks;
  v_owner boolean;
  v_submission_id uuid;
  v_purpose text;
  v_q_form_id uuid;
  v_idx int;
  v_name text; v_email text; v_phone text; v_employer text; v_relationship text;
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
    set answers = excluded.answers, review_status = 'submitted', review_note = null
  returning id into v_submission_id;

  update public.onboarding_tasks
  set status = 'submitted', submission_id = v_submission_id, note = null
  where id = p_task_id;

  -- If this is the applicant's reference form, extract the referees.
  select purpose into v_purpose from public.forms where id = v_task.form_id;
  if v_purpose = 'reference' then
    v_q_form_id := public.ensure_reference_questionnaire(v_task.company_id);

    for v_idx in 1..2 loop
      select p_answers ->> (ff.id::text) into v_name
      from public.form_fields ff
      where ff.form_id = v_task.form_id and ff.label ilike 'Referee ' || v_idx || '%'
        and ff.field_type = 'short_text' and ff.label ilike '%name%'
      order by ff.position limit 1;

      select p_answers ->> (ff.id::text) into v_email
      from public.form_fields ff
      where ff.form_id = v_task.form_id and ff.label ilike 'Referee ' || v_idx || '%'
        and ff.field_type = 'email'
      order by ff.position limit 1;

      select p_answers ->> (ff.id::text) into v_phone
      from public.form_fields ff
      where ff.form_id = v_task.form_id and ff.label ilike 'Referee ' || v_idx || '%'
        and ff.field_type = 'phone'
      order by ff.position limit 1;

      select p_answers ->> (ff.id::text) into v_employer
      from public.form_fields ff
      where ff.form_id = v_task.form_id and ff.label ilike 'Referee ' || v_idx || '%'
        and ff.field_type = 'short_text'
        and (ff.label ilike '%organis%' or ff.label ilike '%company%')
      order by ff.position limit 1;

      select p_answers ->> (ff.id::text) into v_relationship
      from public.form_fields ff
      where ff.form_id = v_task.form_id and ff.label ilike 'Referee ' || v_idx || '%'
        and ff.field_type = 'short_text' and ff.label ilike '%relationship%'
      order by ff.position limit 1;

      if coalesce(trim(v_name), '') <> '' and coalesce(trim(v_email), '') <> ''
         and not exists (
           select 1 from public.reference_requests rr
           where rr.application_id = v_task.application_id
             and lower(rr.referee_email) = lower(trim(v_email))
         )
      then
        insert into public.reference_requests
          (company_id, application_id, applicant_id, referee_name, referee_email,
           referee_employer, referee_phone, relationship, form_id, status)
        values
          (v_task.company_id, v_task.application_id, v_task.applicant_id, trim(v_name), trim(v_email),
           nullif(trim(coalesce(v_employer, '')), ''), nullif(trim(coalesce(v_phone, '')), ''),
           nullif(trim(coalesce(v_relationship, '')), ''), v_q_form_id, 'pending');
      end if;
    end loop;
  end if;
end;
$$;
