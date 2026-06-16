-- ============================================================
-- JOIN CARE NOW — Migration 0036: public Branch/Role option lists
-- The managed-option form fields (branch, role) need the company's lists at
-- render time on the public careers/apply pages, where the viewer is an
-- applicant (not a company member), so RLS would hide branches/roles. This
-- SECURITY DEFINER function returns just the names, by company slug.
-- ============================================================

create or replace function public.get_company_field_options(p_slug text)
returns table (branches jsonb, roles jsonb)
language sql security definer stable set search_path = public
as $$
  select
    coalesce(
      (select jsonb_agg(b.name order by b.name)
         from public.branches b
         join public.companies c on c.id = b.company_id
        where c.slug = p_slug),
      '[]'::jsonb),
    coalesce(
      (select jsonb_agg(r.name order by r.name)
         from public.roles r
         join public.companies c on c.id = r.company_id
        where c.slug = p_slug),
      '[]'::jsonb);
$$;

grant execute on function public.get_company_field_options(text) to anon, authenticated;
