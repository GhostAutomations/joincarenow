-- ============================================================
-- JOIN CARE NOW — Migration 0006: Signature + Body-text fields
-- Adds two field types and a per-field config bag (used by body_text
-- for content/size/colour, and available for future field settings).
-- Run AFTER 0005_forms.sql.
-- ============================================================

-- New field types (ADD VALUE auto-commits; run outside a transaction).
alter type public.form_field_type add value if not exists 'signature';
alter type public.form_field_type add value if not exists 'body_text';

-- Per-field extra settings (e.g. body_text: { text, size, color }).
alter table public.form_fields
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Expose config to the public apply page. Drop first — the return type
-- changes (adds config), which create-or-replace can't do.
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
  field_position int
)
language sql security definer stable set search_path = public
as $$
  select ff.id, ff.label, ff.field_type, ff.required, ff.options,
         ff.help_text, ff.config, ff.position
  from public.jobs j
  join public.form_fields ff on ff.form_id = j.application_form_id
  where j.id = p_job_id and j.status = 'published' and j.application_form_id is not null
  order by ff.position, ff.created_at;
$$;
