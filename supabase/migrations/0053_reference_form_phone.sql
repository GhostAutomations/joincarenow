-- ============================================================
-- JOIN CARE NOW — Migration 0053: phone number on the reference form
-- Adds a Phone number field to the "Your References" form: in the seed (for new
-- companies) and backfilled into existing reference forms that don't have one.
-- 'phone' field type was added in 0049. Run AFTER 0052_your_references_form.sql.
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
    and (purpose = 'reference' or category = 'referencing')
  order by (purpose = 'reference') desc, (category = 'referencing') desc, created_at desc
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

-- Backfill: add a phone field to existing reference forms that don't have one.
insert into public.form_fields (form_id, label, field_type, required, options, position)
select f.id, 'Your contact phone number', 'phone', false, '[]'::jsonb,
       coalesce((select max(ff.position) from public.form_fields ff where ff.form_id = f.id), 0) + 1
from public.forms f
where f.purpose = 'reference'
  and not exists (
    select 1 from public.form_fields ff2
    where ff2.form_id = f.id and ff2.field_type = 'phone'
  );
