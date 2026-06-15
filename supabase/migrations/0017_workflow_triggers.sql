-- ============================================================
-- JOIN CARE NOW — Migration 0017: Workflow stage triggers
-- A checklist task fires at a chosen point: on_application, or when
-- the applicant reaches reviewing / interview / offer / hired.
-- Run AFTER 0016_onboarding_due_date.sql.
-- ============================================================

alter table public.onboarding_templates
  add column if not exists trigger_stage text not null default 'hired';

alter table public.onboarding_tasks
  add column if not exists template_id uuid references public.onboarding_templates (id) on delete set null;

-- Create tasks for templates whose trigger matches, skipping any already made.
create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
begin
  select company_id, applicant_id into v_company_id, v_applicant_id
  from public.applications where id = p_application_id;
  if v_company_id is null then return; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required, t.due_date, t.id, t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id and t.trigger_stage = p_trigger
    and not exists (
      select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id
    );
end;
$$;

-- apply_to_job also fires any "on_application" tasks for the new application.
create or replace function public.apply_to_job(
  p_job_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_postcode text,
  p_cover_message text,
  p_cv_path text,
  p_answers jsonb default '{}'::jsonb,
  p_form_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_applicant_id uuid;
  v_company_id uuid;
  v_status public.job_status;
  v_form_id uuid;
  v_email text;
  v_application_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to apply'; end if;

  select company_id, status, application_form_id into v_company_id, v_status, v_form_id
  from public.jobs where id = p_job_id;
  if v_company_id is null then raise exception 'Job not found'; end if;
  if v_status <> 'published' then raise exception 'This job is not currently accepting applications'; end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.applicants (user_id, first_name, last_name, email, phone, postcode)
  values (auth.uid(), p_first_name, p_last_name, v_email, p_phone, p_postcode)
  on conflict (user_id) do update
    set first_name = coalesce(excluded.first_name, public.applicants.first_name),
        last_name  = coalesce(excluded.last_name, public.applicants.last_name),
        phone      = coalesce(excluded.phone, public.applicants.phone),
        postcode   = coalesce(excluded.postcode, public.applicants.postcode)
  returning id into v_applicant_id;

  insert into public.applications (company_id, job_id, applicant_id, cover_message, cv_path, answers)
  values (v_company_id, p_job_id, v_applicant_id, p_cover_message, p_cv_path, coalesce(p_answers, '{}'::jsonb))
  on conflict (job_id, applicant_id) do nothing
  returning id into v_application_id;

  if v_application_id is null then raise exception 'You have already applied for this role'; end if;

  if v_form_id is not null and p_form_answers is not null and p_form_answers <> '{}'::jsonb then
    insert into public.form_submissions (company_id, form_id, application_id, applicant_id, answers)
    values (v_company_id, v_form_id, v_application_id, v_applicant_id, p_form_answers)
    on conflict (application_id, form_id) do nothing;
  end if;

  -- Fire any "on application" workflow tasks.
  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position)
  select v_company_id, v_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required, t.due_date, t.id, t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id and t.trigger_stage = 'on_application';

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'application.created', 'application', v_application_id, jsonb_build_object('job_id', p_job_id));

  return v_application_id;
end;
$$;
