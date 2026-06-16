-- ============================================================
-- JOIN CARE NOW — Migration 0034: Public company profile
-- Exposes a company's public-facing branding + careers content to the
-- (anonymous) careers pages: logo, brand colours, an intro/about blurb and
-- a list of benefits. Brand lives in companies.settings.brand; the careers
-- copy lives in companies.settings.careers = { intro, benefits: text[] }.
-- ============================================================

create or replace function public.get_company_public_profile(p_slug text)
returns table (
  company_id uuid,
  name text,
  slug text,
  logo_url text,
  brand_primary text,
  brand_secondary text,
  brand_accent text,
  intro text,
  benefits jsonb
)
language sql security definer stable set search_path = public
as $$
  select
    c.id,
    c.name,
    c.slug,
    c.settings->'brand'->>'logo_url',
    c.settings->'brand'->>'primary',
    c.settings->'brand'->>'secondary',
    c.settings->'brand'->>'accent',
    c.settings->'careers'->>'intro',
    coalesce(c.settings->'careers'->'benefits', '[]'::jsonb)
  from public.companies c
  where c.slug = p_slug;
$$;

grant execute on function public.get_company_public_profile(text) to anon, authenticated;
