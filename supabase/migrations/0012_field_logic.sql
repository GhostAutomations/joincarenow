-- ============================================================
-- JOIN CARE NOW — Migration 0012: Conditional follow-up fields
-- A field can be a follow-up that only shows when a parent choice
-- field has a specific answer. Run AFTER 0011_address_field.sql.
-- ============================================================

alter table public.form_fields
  add column if not exists parent_field_id uuid references public.form_fields (id) on delete cascade,
  add column if not exists parent_value text;

-- Expose the logic fields to the public apply page.
drop function if exists public.get_application_form(uuid);

create or replace function public.get_application_form(p_job_id uuid)
returns table (
  field_id uuid,
  label text,
  field_type public.form_field_type,
  required boolean,
  options jsonb,
  help_text text,
  config jsonb,
  parent_field_id uuid,
  parent_value text,
  field_position int
)
language sql security definer stable set search_path = public
as $$
  select ff.id, ff.label, ff.field_type, ff.required, ff.options,
         ff.help_text, ff.config, ff.parent_field_id, ff.parent_value, ff.position
  from public.jobs j
  join public.form_fields ff on ff.form_id = j.application_form_id
  where j.id = p_job_id and j.status = 'published' and j.application_form_id is not null
  order by ff.position, ff.created_at;
$$;
