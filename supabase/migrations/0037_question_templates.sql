-- ============================================================
-- JOIN CARE NOW — Migration 0037: Question bank
-- A founder-curated library of ready-made questions that any company can drop
-- into a form from the builder's "+" menu (label + type + options + help all
-- pre-filled). Global (not company-scoped); readable by all signed-in users,
-- editable only by platform admins.
-- ============================================================

create table if not exists public.question_templates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  field_type public.form_field_type not null default 'short_text',
  options jsonb not null default '[]'::jsonb,
  help_text text,
  category text not null default 'General',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_templates_cat
  on public.question_templates (category, position);

drop trigger if exists trg_question_templates_updated on public.question_templates;
create trigger trg_question_templates_updated before update on public.question_templates
  for each row execute function public.set_updated_at();

-- ---------- RLS -------------------------------------------------
alter table public.question_templates enable row level security;

-- Any signed-in user can read the bank (shown in the form builder).
drop policy if exists question_templates_select on public.question_templates;
create policy question_templates_select on public.question_templates
  for select to authenticated using (true);

-- Only platform admins (founder) can curate the bank.
drop policy if exists question_templates_write on public.question_templates;
create policy question_templates_write on public.question_templates
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------- Starter set ----------------------------------------
insert into public.question_templates (label, field_type, options, help_text, category, position)
values
  ('Do you have the right to work in the UK?', 'yes_no', '[]'::jsonb, null, 'Right to work', 1),
  ('Do you require sponsorship to work in the UK?', 'yes_no', '[]'::jsonb, null, 'Right to work', 2),
  ('Do you hold a full UK driving licence?', 'yes_no', '[]'::jsonb, null, 'Transport', 1),
  ('Do you have access to your own vehicle?', 'yes_no', '[]'::jsonb, null, 'Transport', 2),
  ('How many years of care experience do you have?', 'number', '[]'::jsonb, null, 'Experience', 1),
  ('Highest relevant care qualification', 'dropdown',
     '["None","NVQ / Diploma Level 2","NVQ / Diploma Level 3","NVQ / Diploma Level 5","Other"]'::jsonb,
     null, 'Experience', 2),
  ('Which types of care do you have experience in?', 'checkboxes',
     '["Domiciliary","Residential","Dementia","Learning disabilities","Mental health","End of life","Children"]'::jsonb,
     'Tick all that apply.', 'Experience', 3),
  ('Do you have an enhanced DBS on the update service?', 'yes_no', '[]'::jsonb, null, 'Compliance', 1),
  ('When does your current DBS expire?', 'date', '[]'::jsonb, 'Leave blank if not applicable.', 'Compliance', 2),
  ('What is your availability?', 'checkboxes',
     '["Weekday mornings","Weekday afternoons","Weekday evenings","Weekends","Nights","Sleep-ins"]'::jsonb,
     'Tick all the shifts you can work.', 'Availability', 1),
  ('How much notice do you need to give your current employer?', 'short_text', '[]'::jsonb, null, 'Availability', 2),
  ('Why do you want to work in care?', 'long_text', '[]'::jsonb, null, 'About you', 1)
on conflict do nothing;
