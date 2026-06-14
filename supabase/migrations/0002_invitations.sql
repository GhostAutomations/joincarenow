-- ============================================================
-- JOIN CARE NOW — Migration 0002: Invitations & Invite-Only Access
-- Staff (admin/manager/recruiter) join ONLY by invitation.
--   • Founder (platform admin) creates companies + invites admins.
--   • Company admins invite managers + recruiters.
-- Applicants self-register separately (built with the jobs phase).
-- Run AFTER 0001_foundations.sql.
-- ============================================================

create extension if not exists pgcrypto;  -- for gen_random_bytes()

-- ---------- 1. create_company becomes FOUNDER-ONLY ----------
-- Previously any signed-in user could create a company and become
-- its admin. Now only the platform admin (founder) provisions
-- companies; the first admin arrives by invitation, not by caller.

create or replace function public.create_company(company_name text, company_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform administrator can create companies';
  end if;
  if length(trim(company_name)) < 2 then
    raise exception 'Company name too short';
  end if;

  insert into public.companies (name, slug)
  values (trim(company_name), company_slug)
  returning id into new_company_id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (new_company_id, auth.uid(), 'company.created', 'company', new_company_id,
          jsonb_build_object('name', company_name, 'slug', company_slug));

  return new_company_id;
end;
$$;

-- ---------- 2. INVITATIONS TABLE ----------------------------

create type public.invite_status as enum ('pending', 'accepted', 'revoked');

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role public.company_role not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  status public.invite_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_invitations_company on public.invitations (company_id);
create index idx_invitations_email on public.invitations (lower(email));

-- Only one OUTSTANDING invite per email per company.
create unique index uniq_pending_invite
  on public.invitations (company_id, lower(email))
  where status = 'pending';

-- ---------- 3. RLS --------------------------------------------
-- Members/admins can READ their company's invitations (to manage
-- them). All writes go through the SECURITY DEFINER RPCs below,
-- so there are no insert/update/delete policies (default deny).

alter table public.invitations enable row level security;

create policy "invitations_select_member" on public.invitations
  for select using (public.is_company_member(company_id));

-- ---------- 4. CREATE INVITATION ------------------------------
-- Permission rules enforced in the database:
--   role = 'admin'              -> caller must be platform admin (founder)
--   role in (manager,recruiter)-> caller must be admin of that company

create or replace function public.create_invitation(
  p_company_id uuid,
  p_email text,
  p_role public.company_role
)
returns public.invitations
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- tier-based permission check
  if p_role = 'admin' then
    if not public.is_platform_admin() then
      raise exception 'Only the founder can invite company admins';
    end if;
  else
    if not public.is_company_admin(p_company_id) then
      raise exception 'Only a company admin can invite managers or recruiters';
    end if;
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  -- already a member of this company?
  if exists (
    select 1 from public.company_users cu
    join public.profiles p on p.id = cu.user_id
    where cu.company_id = p_company_id and lower(p.email) = v_email
  ) then
    raise exception 'That person is already a member of this company';
  end if;

  -- supersede any existing pending invite for this email+company
  update public.invitations
  set status = 'revoked'
  where company_id = p_company_id and lower(email) = v_email and status = 'pending';

  insert into public.invitations (company_id, email, role, invited_by)
  values (p_company_id, v_email, p_role, auth.uid())
  returning * into v_invite;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (p_company_id, auth.uid(), 'invitation.created', 'invitation', v_invite.id,
          jsonb_build_object('email', v_email, 'role', p_role));

  return v_invite;
end;
$$;

-- ---------- 5. GET INVITATION (for the accept page) -----------
-- Returns SAFE fields by token. Callable by anyone (incl. anon),
-- because the invitee is not yet a member and the token is the
-- secret. Never exposes the table directly.

create or replace function public.get_invitation(p_token text)
returns table (
  email text,
  role public.company_role,
  company_name text,
  status public.invite_status,
  is_expired boolean
)
language sql security definer stable set search_path = public
as $$
  select i.email,
         i.role,
         c.name as company_name,
         i.status,
         (i.expires_at < now()) as is_expired
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

-- ---------- 6. ACCEPT INVITATION ------------------------------
-- Runs as the now-authenticated invitee. Verifies the signed-in
-- email matches the invite, then creates the membership.

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invite public.invitations;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation';
  end if;

  select * into v_invite
  from public.invitations
  where token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'This invitation has already been used or revoked';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invitation has expired';
  end if;

  select lower(email) into v_user_email from public.profiles where id = auth.uid();
  if v_user_email is distinct from lower(v_invite.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.company_users (company_id, user_id, role)
  values (v_invite.company_id, auth.uid(), v_invite.role)
  on conflict (company_id, user_id) do nothing;

  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_invite.company_id, auth.uid(), 'invitation.accepted', 'invitation', v_invite.id,
          jsonb_build_object('email', v_invite.email, 'role', v_invite.role));

  return v_invite.company_id;
end;
$$;

-- ---------- 7. REVOKE INVITATION ------------------------------

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_invite public.invitations;
begin
  select * into v_invite from public.invitations where id = p_id;
  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;

  -- same permission model as creating it
  if v_invite.role = 'admin' then
    if not public.is_platform_admin() then
      raise exception 'Only the founder can revoke admin invitations';
    end if;
  else
    if not public.is_company_admin(v_invite.company_id) then
      raise exception 'Only a company admin can revoke this invitation';
    end if;
  end if;

  update public.invitations set status = 'revoked' where id = p_id and status = 'pending';

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, before)
  values (v_invite.company_id, auth.uid(), 'invitation.revoked', 'invitation', v_invite.id,
          jsonb_build_object('email', v_invite.email, 'role', v_invite.role));
end;
$$;
