-- ============================================================
-- JOIN CARE NOW — Migration 0033: Carer.Academy integration
-- When an employee is created (applicant reaches Hired), Join Care Now
-- pushes their details to Carer.Academy so a training account is created.
-- This migration adds per-employee sync state and a general-purpose
-- integration_events log (every outbound attempt, success or failure).
-- Run AFTER 0018_employees.sql.
-- ============================================================

-- ---------- Per-employee sync state -------------------------
alter table public.employees
  add column if not exists carer_academy_status text not null default 'pending'
    check (carer_academy_status in ('pending', 'synced', 'error', 'disabled')),
  add column if not exists carer_academy_user_id text,
  add column if not exists carer_academy_synced_at timestamptz,
  add column if not exists carer_academy_error text;

-- ---------- Integration events (audit + retry log) ----------
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  target text not null default 'carer_academy',   -- which system
  event text not null default 'employee.sync',     -- what we tried to do
  status text not null check (status in ('success', 'error')),
  attempt int not null default 1,
  request jsonb,
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_events_company
  on public.integration_events (company_id, created_at desc);
create index if not exists idx_integration_events_employee
  on public.integration_events (employee_id, created_at desc);

-- ---------- RLS ---------------------------------------------
alter table public.integration_events enable row level security;

-- Company members can read their own integration history.
drop policy if exists integration_events_select_member on public.integration_events;
create policy integration_events_select_member on public.integration_events
  for select using (public.is_company_member(company_id));
-- Inserts/updates happen server-side via the service role (bypasses RLS) or
-- through the SECURITY DEFINER helper below; no client insert policy needed.

-- ---------- Helper: record an event + update employee state -
-- Called from the server after each Carer.Academy POST. SECURITY DEFINER so
-- it can write the log and update sync state in one place under RLS.
create or replace function public.log_carer_academy_sync(
  p_employee_id uuid,
  p_status text,                 -- 'success' | 'error'
  p_attempt int,
  p_request jsonb,
  p_response jsonb,
  p_error text,
  p_academy_user_id text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null then return; end if;
  if not public.is_company_member(v_company_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.integration_events
    (company_id, employee_id, target, event, status, attempt, request, response, error)
  values
    (v_company_id, p_employee_id, 'carer_academy', 'employee.sync',
     p_status, p_attempt, p_request, p_response, p_error);

  update public.employees set
    carer_academy_status = case when p_status = 'success' then 'synced' else 'error' end,
    carer_academy_synced_at = case when p_status = 'success' then now() else carer_academy_synced_at end,
    carer_academy_user_id = coalesce(p_academy_user_id, carer_academy_user_id),
    carer_academy_error = case when p_status = 'success' then null else p_error end
  where id = p_employee_id;
end;
$$;
