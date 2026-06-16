-- ============================================================
-- JOIN CARE NOW — Migration 0028: Accept an applicant's proposed time
-- When an applicant requests a new interview time, staff can accept it
-- in one click (sets that time and marks the interview confirmed).
-- Run AFTER 0027_realtime.sql.
-- ============================================================

create or replace function public.confirm_interview_at(
  p_application_id uuid,
  p_scheduled_at timestamptz
)
returns public.interviews
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_row public.interviews;
begin
  select company_id into v_company_id
  from public.interviews where application_id = p_application_id;
  if v_company_id is null then raise exception 'Interview not found'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Not allowed'; end if;

  update public.interviews
  set scheduled_at = p_scheduled_at,
      status = 'confirmed',
      requested_time = null
  where application_id = p_application_id
  returning * into v_row;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_company_id, auth.uid(), 'interview.confirmed', 'interview', v_row.id,
          jsonb_build_object('scheduled_at', p_scheduled_at));

  return v_row;
end;
$$;
