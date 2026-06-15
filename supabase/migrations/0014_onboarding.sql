-- ============================================================
-- JOIN CARE NOW — Migration 0014: Onboarding
-- Company defines an onboarding checklist (templates); when an
-- applicant is hired, tasks are instantiated for them. Task types:
-- form (fill one of the company's forms), document (upload), or
-- acknowledge (read & confirm). Run AFTER 0013_page_break.sql.
-- ============================================================

create type public.onboarding_task_type as enum ('form', 'document', 'acknowledge');
create type public.onboarding_status as enum ('pending', 'submitted', 'approved', 'rejected');

-- ---------- Checklist templates (per company) ----------------
create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  task_type public.onboarding_task_type not null,
  form_id uuid references public.forms (id) on delete set null,
  body text,                       -- instructions, or the text to acknowledge
  required boolean not null default true,
  due_days int,                    -- days after start the task is due
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_onb_templates_company on public.onboarding_templates (company_id, position);

-- ---------- Per-applicant tasks ------------------------------
create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  title text not null,
  task_type public.onboarding_task_type not null,
  form_id uuid references public.forms (id) on delete set null,
  body text,
  required boolean not null default true,
  status public.onboarding_status not null default 'pending',
  submission_id uuid references public.form_submissions (id) on delete set null,
  doc_path text,
  note text,                       -- reviewer note
  due_date date,
  reviewed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_onb_tasks_company on public.onboarding_tasks (company_id);
create index idx_onb_tasks_application on public.onboarding_tasks (application_id);
create index idx_onb_tasks_applicant on public.onboarding_tasks (applicant_id);

create trigger trg_onb_tasks_updated before update on public.onboarding_tasks
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------------------------------------------
alter table public.onboarding_templates enable row level security;
alter table public.onboarding_tasks enable row level security;

-- Templates: company members manage.
create policy onb_tpl_select on public.onboarding_templates
  for select using (public.is_company_member(company_id));
create policy onb_tpl_insert on public.onboarding_templates
  for insert with check (public.is_company_member(company_id));
create policy onb_tpl_update on public.onboarding_templates
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
create policy onb_tpl_delete on public.onboarding_templates
  for delete using (public.is_company_member(company_id));

-- Tasks: company members see/manage; applicant sees their own.
create policy onb_task_select_company on public.onboarding_tasks
  for select using (public.is_company_member(company_id));
create policy onb_task_select_applicant on public.onboarding_tasks
  for select using (public.is_applicant_owner(applicant_id));
create policy onb_task_update_company on public.onboarding_tasks
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
-- Inserts + applicant updates go through the SECURITY DEFINER RPCs below.

-- ---------- Start onboarding (instantiate checklist) ---------
create or replace function public.start_onboarding(p_application_id uuid)
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

  -- idempotent: don't duplicate if already started
  if exists (select 1 from public.onboarding_tasks where application_id = p_application_id) then
    return;
  end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required, due_date, position)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body, t.required,
         case when t.due_days is not null then (current_date + t.due_days) else null end,
         t.position
  from public.onboarding_templates t
  where t.company_id = v_company_id
  order by t.position;
end;
$$;

-- ---------- Applicant: list my onboarding tasks --------------
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
  order by ot.position, ot.created_at;
$$;

-- ---------- Applicant: form fields for a form task -----------
create or replace function public.get_onboarding_form(p_task_id uuid)
returns table (
  field_id uuid, label text, field_type public.form_field_type, required boolean,
  options jsonb, help_text text, config jsonb, parent_field_id uuid, parent_value text, field_position int
)
language sql security definer stable set search_path = public
as $$
  select ff.id, ff.label, ff.field_type, ff.required, ff.options, ff.help_text, ff.config,
         ff.parent_field_id, ff.parent_value, ff.position
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  join public.form_fields ff on ff.form_id = ot.form_id
  where ot.id = p_task_id and ap.user_id = auth.uid()
  order by ff.position, ff.created_at;
$$;

-- ---------- Applicant: submit a form task --------------------
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

  insert into public.form_submissions (company_id, form_id, application_id, applicant_id, answers)
  values (v_task.company_id, v_task.form_id, v_task.application_id, v_task.applicant_id, coalesce(p_answers, '{}'::jsonb))
  returning id into v_submission_id;

  update public.onboarding_tasks
  set status = 'submitted', submission_id = v_submission_id
  where id = p_task_id;
end;
$$;

-- ---------- Applicant: upload doc / acknowledge --------------
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
end;
$$;

create or replace function public.acknowledge_onboarding(p_task_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.onboarding_tasks ot
    join public.applicants ap on ap.id = ot.applicant_id
    where ot.id = p_task_id and ap.user_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;
  update public.onboarding_tasks set status = 'approved', completed_at = now() where id = p_task_id;
end;
$$;
