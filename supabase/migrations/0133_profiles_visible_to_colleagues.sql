-- ============================================================
-- JOIN CARE NOW — Migration 0133: colleagues can read each other's profiles
-- The original policy only let you read your OWN profile, so team lists,
-- interviews, messaging, job-owner names, etc. came back blank for every
-- member except yourself. Allow members of the same company to read each
-- other's profile (name + email), enforced at the DB.
-- Run AFTER 0001_foundations.sql.
-- ============================================================

-- SECURITY DEFINER so the policy can check the membership join without
-- triggering RLS on company_users (avoids recursion). search_path pinned.
create or replace function public.shares_company_with(p_target uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.company_users a
    join public.company_users b on b.company_id = a.company_id
    where a.user_id = auth.uid()
      and b.user_id = p_target
  );
$$;

-- Additive: keeps the existing self/platform-admin select policy; this one
-- broadens read access to same-company colleagues only.
drop policy if exists "profiles_select_company" on public.profiles;
create policy "profiles_select_company" on public.profiles
  for select using (public.shares_company_with(id));
