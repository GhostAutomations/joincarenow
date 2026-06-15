-- ============================================================
-- JOIN CARE NOW — Migration 0009: Form styling + logo
-- Stores title/description formatting (colour, size, alignment) and a
-- logo URL in forms.style. Adds a public "branding" bucket for logos.
-- Run AFTER 0008_form_description.sql.
-- ============================================================

alter table public.forms
  add column if not exists style jsonb not null default '{}'::jsonb;

-- Public bucket for company/form logos (served via public URL).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy branding_read_all on storage.objects
  for select using (bucket_id = 'branding');

create policy branding_upload_auth on storage.objects
  for insert to authenticated with check (bucket_id = 'branding');

create policy branding_update_auth on storage.objects
  for update to authenticated using (bucket_id = 'branding');
