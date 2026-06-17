-- ============================================================
-- JOIN CARE NOW — Migration 0050: use the company's chosen reference form
-- ensure_reference_form now prefers the company's own form (one tagged with the
-- "referencing" category, or purpose = 'reference'), so a form the company built
-- in the Form Builder is used for reference requests. Only if none exists do we
-- seed the default care template (now tagged category = 'referencing').
-- Run AFTER 0049_email_phone_field_types.sql.
-- ============================================================

create or replace function public.ensure_reference_form(p_company_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_form_id uuid;
begin
  -- Prefer the company's own reference form: a form in the "referencing"
  -- category, or one explicitly marked purpose = 'reference'. Category wins,
  -- then most recently created.
  select id into v_form_id
  from public.forms
  where company_id = p_company_id
    and coalesce(is_store, false) = false
    and (category = 'referencing' or purpose = 'reference')
  order by (category = 'referencing') desc, created_at desc
  limit 1;
  if v_form_id is not null then return v_form_id; end if;

  -- Otherwise seed a default care reference template.
  insert into public.forms (company_id, name, purpose, category)
  values (p_company_id, 'Employment reference', 'reference', 'referencing')
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
