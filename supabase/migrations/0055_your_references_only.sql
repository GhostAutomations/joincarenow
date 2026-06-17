-- ============================================================
-- JOIN CARE NOW — Migration 0055: "Your References" is the canonical form
-- ensure_reference_form now only recognises the system form (purpose =
-- 'reference'); it no longer latches onto other referencing-category forms
-- (e.g. a store form the company added). If the system form is missing it is
-- created as "Your References" (with the phone field from 0053).
-- Run AFTER 0054_request_cv.sql.
-- ============================================================

create or replace function public.ensure_reference_form(p_company_id uuid)
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
    and purpose = 'reference'
  order by created_at
  limit 1;
  if v_form_id is not null then return v_form_id; end if;

  insert into public.forms (company_id, name, purpose, category)
  values (p_company_id, 'Your References', 'reference', 'referencing')
  returning id into v_form_id;

  insert into public.form_fields (form_id, label, field_type, required, options, position)
  values
    (v_form_id, 'In what capacity do you know the applicant?', 'short_text', true, '[]'::jsonb, 1),
    (v_form_id, 'What were the dates of their employment (from – to)?', 'short_text', true, '[]'::jsonb, 2),
    (v_form_id, 'What was their job title / role?', 'short_text', true, '[]'::jsonb, 3),
    (v_form_id, 'Your contact phone number', 'phone', false, '[]'::jsonb, 4),
    (v_form_id, 'How would you rate their reliability and punctuality?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 5),
    (v_form_id, 'How would you rate their care and compassion?', 'radio', true,
       '["Excellent","Good","Satisfactory","Poor"]'::jsonb, 6),
    (v_form_id, 'Were there any safeguarding or disciplinary concerns?', 'yes_no', true, '[]'::jsonb, 7),
    (v_form_id, 'If yes, please provide details', 'long_text', false, '[]'::jsonb, 8),
    (v_form_id, 'Would you re-employ this person?', 'yes_no', true, '[]'::jsonb, 9),
    (v_form_id, 'Any additional comments', 'long_text', false, '[]'::jsonb, 10);

  return v_form_id;
end;
$$;
