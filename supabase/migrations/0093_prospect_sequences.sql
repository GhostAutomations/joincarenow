-- ============================================================
-- JOIN CARE NOW — Migration 0093: prospect sequences (multi-step follow-ups)
-- Founder-only. A sequence has ordered steps (delay + message). Contacts are
-- enrolled; an hourly cron sends the next due step and stops automatically when
-- the contact replies or opts out. Run AFTER 0092_prospect_unsub.sql.
-- ============================================================

create table if not exists public.prospect_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'email' check (channel in ('email','sms')),
  auto_send boolean not null default true,   -- false => every step needs approval (slice 6)
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.prospect_sequences (id) on delete cascade,
  position int not null default 0,
  delay_days int not null default 0,         -- days after the previous step (0 = immediately)
  subject text,
  body text not null,
  high_risk boolean not null default false,  -- price/contract/compliance => always needs human
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_steps_seq on public.prospect_sequence_steps (sequence_id, position);

create table if not exists public.prospect_enrolments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.prospect_sequences (id) on delete cascade,
  prospect_company_id uuid not null references public.prospect_companies (id) on delete cascade,
  contact_id uuid not null references public.prospect_contacts (id) on delete cascade,
  status text not null default 'active' check (status in ('active','stopped','done')),
  step_index int not null default 0,
  next_run_at timestamptz not null default now(),
  stopped_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_enrol_due on public.prospect_enrolments (status, next_run_at);

do $$
declare t text;
begin
  foreach t in array array['prospect_sequences','prospect_sequence_steps','prospect_enrolments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_founder', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t || '_founder', t
    );
  end loop;
end $$;
