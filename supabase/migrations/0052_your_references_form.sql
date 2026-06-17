-- ============================================================
-- JOIN CARE NOW — Migration 0052: "Your References" form
-- The reference form the system provides is now named "Your References", lives
-- in the "referencing" category, and is editable in the Form Builder + selectable
-- in workflows. ensure_reference_form prefers this system form (purpose =
-- 'reference') over any other referencing-category form, and creates it on demand.
-- Run AFTER 0051_send_adhoc_form.sql.
-- ============================================================

create or replace function public.ensure_reference_form(p_company_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_form_id uuid;
begin
  -- Prefer the system reference form (purpose = 'reference'); then any form in
  -- the "referencing" category; most recently created wins among equals.
  select id into v_form_id
  from public.forms
  where company_id = p_company_id
    and coalesce(is_store, false) = false
    and (purpose = 'reference' or category = 'referencing')
  order by (purpose = 'reference') desc, (category = 'referencing') desc, created_at desc
  limit 1;
  if v_form_id is not null then return v_form_id; end if;

  -- Otherwise seed the default care reference template, named "Your References".
  insert into public.forms (company_id, name, purpose, category)
  values (p_company_id, 'Your References', 'reference', 'referencing')
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

-- Rename any existing seeded form so it reads "Your References".
update public.forms
set name = 'Your References'
where purpose = 'reference' and name = 'Employment reference';
