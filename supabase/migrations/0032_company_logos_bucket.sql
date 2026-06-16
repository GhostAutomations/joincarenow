-- Public storage bucket for company logos (shown in the app chrome + careers pages).
-- Logos are not sensitive, so the bucket is public-read. Uploads happen
-- server-side with the service-role key (bypasses RLS), so we do NOT create
-- policies on storage.objects here — those require table ownership the
-- migration role doesn't have, which previously aborted `db push`.
--
-- The bucket insert is wrapped so that, even on a locked-down project where the
-- migration role can't write storage.buckets, this migration still succeeds and
-- later migrations apply. If the bucket isn't created here, create it once in
-- the Supabase dashboard (Storage → New bucket → "company-logos", public).

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('company-logos', 'company-logos', true)
  on conflict (id) do update set public = true;
exception when others then
  raise notice 'company-logos bucket not created by migration (%). Create it in the dashboard.', sqlerrm;
end $$;
