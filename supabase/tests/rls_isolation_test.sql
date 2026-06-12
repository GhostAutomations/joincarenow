-- ============================================================
-- RLS CROSS-TENANT ISOLATION TEST
-- Run in Supabase SQL Editor AFTER 0001_foundations.sql.
-- Creates two fake users + two companies, then proves user A
-- cannot see company B. Everything rolls back at the end.
-- ============================================================

begin;

-- Create two fake auth users
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'usera@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'userb@test.local');

-- Profiles are created by trigger. Create one company per user.
insert into public.companies (id, name, slug) values
  ('00000000-0000-0000-0000-0000000000c1', 'Company A', 'company-a'),
  ('00000000-0000-0000-0000-0000000000c2', 'Company B', 'company-b');

insert into public.company_users (company_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', 'admin');

-- Impersonate user A
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- TEST 1: user A sees exactly one company (their own)
do $$
declare n int;
begin
  select count(*) into n from public.companies;
  if n <> 1 then
    raise exception 'FAIL: user A sees % companies, expected 1', n;
  end if;
  raise notice 'PASS: user A sees only their own company';
end $$;

-- TEST 2: user A cannot see company B by ID
do $$
declare n int;
begin
  select count(*) into n from public.companies
  where id = '00000000-0000-0000-0000-0000000000c2';
  if n <> 0 then
    raise exception 'FAIL: user A can see company B';
  end if;
  raise notice 'PASS: company B invisible to user A';
end $$;

-- TEST 3: user A cannot update company B
do $$
begin
  update public.companies set name = 'Hacked'
  where id = '00000000-0000-0000-0000-0000000000c2';
  if found then
    raise exception 'FAIL: user A updated company B';
  end if;
  raise notice 'PASS: user A cannot update company B';
end $$;

-- TEST 4: user A cannot insert themselves into company B
do $$
begin
  begin
    insert into public.company_users (company_id, user_id, role)
    values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000a', 'admin');
    raise exception 'FAIL: user A joined company B';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: user A cannot join company B';
  end;
end $$;

rollback;  -- leaves no test data behind
