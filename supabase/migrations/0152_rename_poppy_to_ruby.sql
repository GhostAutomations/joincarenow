-- ============================================================
-- JOIN CARE NOW — Migration 0152: Rename Poppy → Ruby
-- Full rebrand of the AI assistant. Renames every DB object, enum value,
-- stored tier value and settings key from poppy → ruby. Code is renamed in
-- the same deploy; ship this BEFORE (or with) the code push.
-- Old migrations 0135–0151 are applied history and are NOT touched.
-- Backwards compat: none needed at DB level — code and DB switch together.
-- Run AFTER 0151_remove_from_talent_pool.sql.
-- ============================================================

-- 1. Tables ---------------------------------------------------
alter table if exists public.poppy_reports rename to ruby_reports;
alter table if exists public.poppy_applicant_credits rename to ruby_applicant_credits;

-- 2. Indexes --------------------------------------------------
alter index if exists public.poppy_reports_company_idx rename to ruby_reports_company_idx;
alter index if exists public.poppy_credits_company_month_idx rename to ruby_credits_company_month_idx;

-- 3. Policies -------------------------------------------------
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'ruby_reports' and policyname = 'poppy_reports_select') then
    alter policy "poppy_reports_select" on public.ruby_reports rename to "ruby_reports_select";
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'ruby_applicant_credits' and policyname = 'poppy_credits_select') then
    alter policy "poppy_credits_select" on public.ruby_applicant_credits rename to "ruby_credits_select";
  end if;
end $$;

-- 4. Columns --------------------------------------------------
alter table public.companies rename column poppy_enabled to ruby_enabled;

alter table public.onboarding_templates rename column poppy_engage to ruby_engage;
alter table public.onboarding_templates rename column poppy_form_ids to ruby_form_ids;
alter table public.onboarding_templates rename column poppy_include_cv to ruby_include_cv;
alter table public.onboarding_templates rename column poppy_focus to ruby_focus;
alter table public.onboarding_templates rename column poppy_instructions to ruby_instructions;
alter table public.onboarding_templates rename column poppy_question_count to ruby_question_count;
alter table public.onboarding_templates rename column poppy_document_ids to ruby_document_ids;
alter table public.onboarding_templates rename column poppy_upload_kinds to ruby_upload_kinds;

alter table public.onboarding_tasks rename column poppy_engage to ruby_engage;
alter table public.onboarding_tasks rename column poppy_form_ids to ruby_form_ids;
alter table public.onboarding_tasks rename column poppy_include_cv to ruby_include_cv;

alter table public.messages rename column from_poppy to from_ruby;

-- 5. Enum value (rows update automatically) -------------------
alter type public.onboarding_task_type rename value 'poppy' to 'ruby';

-- 6. Tier values + check constraints --------------------------
-- Inline checks were auto-named <table>_<column>_check.
alter table public.companies drop constraint if exists companies_plan_tier_check;
alter table public.companies drop constraint if exists companies_agreed_tier_check;
update public.companies set plan_tier = 'ruby' where plan_tier = 'poppy';
update public.companies set agreed_tier = 'ruby' where agreed_tier = 'poppy';
alter table public.companies
  add constraint companies_plan_tier_check check (plan_tier in ('core', 'ruby'));
alter table public.companies
  add constraint companies_agreed_tier_check check (agreed_tier in ('core', 'ruby'));

-- 7. JSON settings keys + notification types ------------------
update public.companies
  set settings = (settings - 'poppy') || jsonb_build_object('ruby', settings->'poppy')
  where settings ? 'poppy';
update public.companies
  set settings = (settings - 'poppy_offer') || jsonb_build_object('ruby_offer', settings->'poppy_offer')
  where settings ? 'poppy_offer';
update public.notifications set type = 'ruby_offer' where type = 'poppy_offer';

-- 8. create_stage_tasks — recreate with the renamed enum value
-- (same body as 0147, 'poppy' → 'ruby'; still excludes Ruby steps from
-- applicant task seeding, still idempotent, still ownership-guarded).
create or replace function public.create_stage_tasks(p_application_id uuid, p_trigger text)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_company_id uuid; v_applicant_id uuid; v_role_id uuid;
begin
  select a.company_id, a.applicant_id, coalesce(j.workflow_role_id, j.role_id)
    into v_company_id, v_applicant_id, v_role_id
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
  if v_company_id is null then return; end if;
  if not (public.is_company_member(v_company_id)
    or exists (select 1 from public.applicants ap where ap.id = v_applicant_id and ap.user_id = auth.uid())
  ) then raise exception 'Not allowed'; end if;

  insert into public.onboarding_tasks
    (company_id, application_id, applicant_id, title, task_type, form_id, body, required,
     due_date, template_id, position, document_id, document_kind, doc_kind)
  select v_company_id, p_application_id, v_applicant_id, t.title, t.task_type, t.form_id, t.body,
         t.required,
         case when t.due_days is not null then (current_date + t.due_days) else null end,
         t.id, t.position, t.document_id, t.document_kind, t.doc_kind
  from public.onboarding_templates t
  where t.company_id = v_company_id and t.trigger_stage = p_trigger and t.task_type <> 'ruby'
    and ((coalesce(array_length(t.role_ids, 1), 0) = 0 and t.role_id is null)
      or (v_role_id is not null and v_role_id = any (t.role_ids))
      or (v_role_id is not null and t.role_id = v_role_id))
    and not exists (select 1 from public.onboarding_tasks ot
      where ot.application_id = p_application_id and ot.template_id = t.id);
end;
$function$;
