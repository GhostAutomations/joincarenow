-- ============================================================
-- JOIN CARE NOW — Migration 0149: two-sided document uploads (DBS front + back)
-- Some uploads (DBS certificate) need a photo of both sides. Store the back in
-- doc_path_back and add an RPC to submit both. Run AFTER 0148.
-- ============================================================

alter table public.onboarding_tasks add column if not exists doc_path_back text;

create or replace function public.set_onboarding_doc_two(
  p_task_id uuid, p_front text, p_back text
)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(btrim(p_front), '') = '' or coalesce(btrim(p_back), '') = '' then
    raise exception 'Both the front and back are required';
  end if;
  if not exists (
    select 1 from public.onboarding_tasks ot
    join public.applicants ap on ap.id = ot.applicant_id
    where ot.id = p_task_id and ap.user_id = auth.uid()
  ) then raise exception 'Not allowed'; end if;

  update public.onboarding_tasks
     set doc_path = p_front,
         doc_path_back = p_back,
         status = 'submitted',
         updated_at = now()
   where id = p_task_id;
end;
$function$;
grant execute on function public.set_onboarding_doc_two(uuid, text, text) to authenticated;
