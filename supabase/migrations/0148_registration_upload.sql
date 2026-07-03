-- ============================================================
-- JOIN CARE NOW — Migration 0148: care worker registration upload
-- A "Care worker registration" upload (Social Care Wales / SSSC / NISCC) lets the
-- applicant enter a registration number and optionally upload a photo of their
-- card/certificate. Adds reg_number to onboarding_tasks and exposes doc_kind +
-- reg_number to the applicant's task list. Run AFTER 0147.
-- ============================================================

alter table public.onboarding_tasks add column if not exists reg_number text;

-- Expose doc_kind + reg_number so the portal can render the registration task.
drop function if exists public.get_my_onboarding();
create function public.get_my_onboarding()
returns table(task_id uuid, title text, task_type onboarding_task_type, status onboarding_status,
              body text, form_id uuid, due_date date, company_name text, note text,
              document_id uuid, document_kind text, doc_kind text, reg_number text)
language sql stable security definer set search_path to 'public'
as $function$
  select ot.id, ot.title, ot.task_type, ot.status, ot.body, ot.form_id, ot.due_date, c.name, ot.note,
         ot.document_id, ot.document_kind, ot.doc_kind, ot.reg_number
  from public.onboarding_tasks ot
  join public.applicants ap on ap.id = ot.applicant_id
  join public.companies c on c.id = ot.company_id
  where ap.user_id = auth.uid()
  order by ot.updated_at desc, ot.created_at desc;
$function$;

-- Applicant submits a registration: number (required) + optional card/cert path.
create or replace function public.set_onboarding_registration(
  p_task_id uuid, p_number text, p_path text default null
)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(btrim(p_number), '') = '' then raise exception 'A registration number is required'; end if;
  if not exists (
    select 1 from public.onboarding_tasks ot
    join public.applicants ap on ap.id = ot.applicant_id
    where ot.id = p_task_id and ap.user_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;

  update public.onboarding_tasks
     set reg_number = btrim(p_number),
         doc_path = nullif(btrim(coalesce(p_path, '')), ''),
         status = 'submitted',
         updated_at = now()
   where id = p_task_id;
end;
$function$;
grant execute on function public.set_onboarding_registration(uuid, text, text) to authenticated;
