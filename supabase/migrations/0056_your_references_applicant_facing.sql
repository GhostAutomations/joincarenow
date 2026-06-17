-- ============================================================
-- JOIN CARE NOW — Migration 0056: "Your References" is applicant-facing
-- The form is completed by the APPLICANT to give their referees' contact
-- details (not the referee-assessment questions, which were wrong here).
-- Reseeds ensure_reference_form and replaces the fields on any existing
-- auto-seeded reference form (detected by the old assessment question).
-- Run AFTER 0055_your_references_only.sql.
-- ============================================================

create or replace function public.seed_your_references_fields(p_form_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.form_fields (form_id, label, field_type, required, options, config, position)
  values
    (p_form_id, 'Your referees', 'body_text', false, '[]'::jsonb,
       jsonb_build_object('text',
         'Please provide two referees. One should be your most recent employer. A character reference cannot be accepted.',
         'size','normal','color','#374151'), 1),
    (p_form_id, 'Referee 1 — full name', 'short_text', true, '[]'::jsonb, '{}'::jsonb, 2),
    (p_form_id, 'Referee 1 — their relationship to you (e.g. line manager)', 'short_text', true, '[]'::jsonb, '{}'::jsonb, 3),
    (p_form_id, 'Referee 1 — organisation / company', 'short_text', false, '[]'::jsonb, '{}'::jsonb, 4),
    (p_form_id, 'Referee 1 — email address', 'email', true, '[]'::jsonb, '{}'::jsonb, 5),
    (p_form_id, 'Referee 1 — phone number', 'phone', false, '[]'::jsonb, '{}'::jsonb, 6),
    (p_form_id, 'Referee 2', 'body_text', false, '[]'::jsonb,
       jsonb_build_object('text','', 'size','normal','color','#374151'), 7),
    (p_form_id, 'Referee 2 — full name', 'short_text', true, '[]'::jsonb, '{}'::jsonb, 8),
    (p_form_id, 'Referee 2 — their relationship to you', 'short_text', true, '[]'::jsonb, '{}'::jsonb, 9),
    (p_form_id, 'Referee 2 — organisation / company', 'short_text', false, '[]'::jsonb, '{}'::jsonb, 10),
    (p_form_id, 'Referee 2 — email address', 'email', true, '[]'::jsonb, '{}'::jsonb, 11),
    (p_form_id, 'Referee 2 — phone number', 'phone', false, '[]'::jsonb, '{}'::jsonb, 12);
$$;

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

  perform public.seed_your_references_fields(v_form_id);
  return v_form_id;
end;
$$;

-- Replace fields on any existing auto-seeded reference form (the old
-- assessment template), leaving customised forms untouched.
do $$
declare r record;
begin
  for r in
    select f.id from public.forms f
    where f.purpose = 'reference'
      and exists (
        select 1 from public.form_fields ff
        where ff.form_id = f.id
          and ff.label = 'How would you rate their reliability and punctuality?'
      )
  loop
    delete from public.form_fields where form_id = r.id;
    perform public.seed_your_references_fields(r.id);
  end loop;
end $$;
