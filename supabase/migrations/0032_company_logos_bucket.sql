-- Public storage bucket for company logos (shown in the app chrome + careers pages).
-- Logos are not sensitive, so the bucket is public-read; writes are restricted below.

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do update set public = true;

-- Anyone can read a logo (it's brand artwork shown publicly).
drop policy if exists "company logos are publicly readable" on storage.objects;
create policy "company logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'company-logos');

-- Only authenticated users may upload/replace/delete logos. The founder-only
-- create flow runs server-side as an authenticated user; tighten later if
-- company admins are allowed to change their own logo.
drop policy if exists "authenticated can write company logos" on storage.objects;
create policy "authenticated can write company logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'company-logos');

drop policy if exists "authenticated can update company logos" on storage.objects;
create policy "authenticated can update company logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'company-logos');

drop policy if exists "authenticated can delete company logos" on storage.objects;
create policy "authenticated can delete company logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'company-logos');
