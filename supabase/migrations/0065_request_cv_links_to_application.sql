-- ============================================================
-- JOIN CARE NOW — Migration 0065: requested CV lands on the application
-- A "Request CV" task is a document task; when the applicant uploads, the file
-- attaches to the task but the pipeline CV section reads applications.cv_path.
-- Mark CV-request tasks (is_cv) and copy the uploaded path onto the application
-- so it shows in the pipeline pop-up. Run AFTER 0064_right_to_work_stage.sql.
-- ============================================================

alter table public.onboarding_tasks
  add column if not exists is_cv boolean not null default false;

-- Request CV: flag the task as a CV request.
create or replace function public.request_cv(p_application_id uuid, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_applicant_id uuid;
  v_pos int;
  v_id uuid;
begin
  select company_id, applicant_id into v_company_id, v_applicant_id
  from public.applications where id = p_application_id;
  if v_company_id is null then raise exception 'Application not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  select coalesce(max(position), 0) + 1 into v_pos
  from public.onboarding_tasks where application_id = p_application_id;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, body, required, status, position, is_cv)
  values
    (v_company_id, p_application_id, v_applicant_id, 'Upload your CV', 'document',
     nullif(trim(coalesce(p_message, '')), ''), true, 'pending', v_pos, true)
  returning id into v_id;

  return v_id;
end;
$$;

-- On upload: set the task doc, and if it's a CV request, copy it onto the application.
create or replace function public.set_onboarding_doc(p_task_id uuid, p_path text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.onboarding_tasks ot
    join public.applicants ap on ap.id = ot.applicant_id
    where ot.id = p_task_id and ap.user_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;

  update public.onboarding_tasks set status = 'submitted', doc_path = p_path where id = p_task_id;

  update public.applications a
  set cv_path = p_path
  from public.onboarding_tasks ot
  where ot.id = p_task_id and ot.is_cv = true and a.id = ot.application_id;
end;
$$;
