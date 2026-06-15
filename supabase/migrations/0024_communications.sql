-- ============================================================
-- JOIN CARE NOW — Migration 0024: Communication Hub
-- Reusable email/SMS templates + a per-applicant message log that
-- powers the CRM-style timeline. Notes are logged as messages too
-- (channel 'note') so everything lives on one timeline.
-- Run AFTER 0023_employee_number_mode.sql.
-- ============================================================

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  name text not null,
  subject text,                       -- email only
  body text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_msg_templates_company on public.message_templates (company_id, channel);

drop trigger if exists trg_msg_templates_updated on public.message_templates;
create trigger trg_msg_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  applicant_id uuid references public.applicants (id) on delete cascade,
  channel text not null check (channel in ('email','sms','note')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  to_address text,                    -- email address or phone number
  subject text,
  body text not null,
  status text not null default 'logged'
    check (status in ('logged','sent','delivered','failed')),
  provider_id text,                   -- Resend/Twilio message id
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_applicant on public.messages (applicant_id, created_at);
create index if not exists idx_messages_application on public.messages (application_id, created_at);

-- ---------- RLS: company members manage their own ------------
alter table public.message_templates enable row level security;
alter table public.messages enable row level security;

drop policy if exists msg_templates_all on public.message_templates;
create policy msg_templates_all on public.message_templates
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

drop policy if exists messages_all on public.messages;
create policy messages_all on public.messages
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
