-- ============================================================
-- JOIN CARE NOW — Migration 0059: reference questionnaire tweaks
--  • Employment dates become month/year pickers (start + end).
--  • A submitted reference link can't be used again (block 'received'/'approved'),
--    but merely opening the link (status 'sent') still works.
-- Run AFTER 0058_month_field_type.sql.
-- ============================================================

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

  perform public.seed_reference_questionnaire_fields(v_form_id);
  return v_form_id;
end;
$$;

create or replace function public.seed_reference_questionnaire_fields(p_form_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.form_fields (form_id, label, field_type, required, options, position)
  values
    (p_form_id, 'In what capacity do you know the applicant?', 'short_text', true, '[]'::jsonb, 1),
    (p_form_id, 'Employment start (month & year)', 'month', true, '[]'::jsonb, 2),
    (p_form_id, 'Employment end (month & year)', 'month', false, '[]'::jsonb, 3),
    (p_form_id, 'What was their job title / role?', 'short_text', true, '[]'::jsonb, 4),
    (p_form_id, 'How would you rate their reliability and punctuality?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 5),
    (p_form_id, 'How would you rate their care and compassion?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 6),
    (p_form_id, 'Were there any safeguarding or disciplinary concerns?', 'yes_no', true, '[]'::jsonb, 7),
    (p_form_id, 'If yes, please provide details', 'long_text', false, '[]'::jsonb, 8),
    (p_form_id, 'Would you re-employ this person?', 'yes_no', true, '[]'::jsonb, 9),
    (p_form_id, 'Any additional comments', 'long_text', false, '[]'::jsonb, 10);
$$;

-- Replace fields on existing questionnaire forms that still have the old
-- free-text employment dates question.
do $$
declare r record;
begin
  for r in
    select f.id from public.forms f
    where f.purpose = 'reference_questionnaire'
      and exists (
        select 1 from public.form_fields ff
        where ff.form_id = f.id
          and ff.label = 'What were the dates of their employment (from – to)?'
      )
  loop
    delete from public.form_fields where form_id = r.id;
    perform public.seed_reference_questionnaire_fields(r.id);
  end loop;
end $$;

-- Link can only be submitted once: block when already received or approved.
create or replace function public.submit_reference_by_token(p_token uuid, p_answers jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_company_id uuid;
  v_status text;
begin
  select id, company_id, status into v_id, v_company_id, v_status
  from public.reference_requests where token = p_token;
  if v_id is null then raise exception 'Reference not found'; end if;
  if v_status in ('received', 'approved') then
    raise exception 'This reference has already been submitted';
  end if;

  update public.reference_requests
  set answers = coalesce(p_answers, '{}'::jsonb),
      status = 'received',
      received_at = now(),
      review_note = null
  where id = v_id;

  insert into public.audit_logs (company_id, action, entity_type, entity_id, after)
  values (v_company_id, 'reference.received', 'reference', v_id,
          jsonb_build_object('via', 'token'));
end;
$$;
