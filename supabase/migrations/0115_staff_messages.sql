-- Internal staff-to-staff messaging within a company (recruiter level and up).
-- A 1:1 message between two staff that may be tagged to an applicant — in which
-- case it appears in that applicant's audit trail (staff-visible). Applicants
-- have NO access (no applicant RLS policy here).
create table if not exists public.staff_messages (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  sender_id      uuid not null references public.profiles (id) on delete cascade,
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  body           text not null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_staff_messages_company on public.staff_messages (company_id, created_at);
create index if not exists idx_staff_messages_pair on public.staff_messages (company_id, sender_id, recipient_id);
create index if not exists idx_staff_messages_app on public.staff_messages (application_id);
create index if not exists idx_staff_messages_recipient on public.staff_messages (recipient_id, read_at);

alter table public.staff_messages enable row level security;

-- Company staff read internal messages (their own DMs + applicant audit trail).
drop policy if exists staff_messages_select on public.staff_messages;
create policy staff_messages_select on public.staff_messages
  for select using (public.is_company_member(company_id));

-- Only a company member may send, and only as themselves.
drop policy if exists staff_messages_insert on public.staff_messages;
create policy staff_messages_insert on public.staff_messages
  for insert with check (public.is_company_member(company_id) and sender_id = auth.uid());

-- Mark-as-read by a company member.
drop policy if exists staff_messages_update on public.staff_messages;
create policy staff_messages_update on public.staff_messages
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- Live updates. REPLICA IDENTITY FULL so UPDATE events (read_at) pass RLS.
alter table public.staff_messages replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.staff_messages';
  end if;
end $$;
