-- ============================================================
-- JOIN CARE NOW — Migration 0132: Invitee name on invitations
-- Capture the person's name when inviting them, so it shows on
-- pending invites and seeds their profile name on accept — which
-- is what surfaces in interviews, messaging, etc. (instead of an
-- email until they sign up).
-- Run AFTER 0002_invitations.sql.
-- ============================================================

alter table public.invitations
  add column if not exists invited_name text;

-- ---------- create_invitation: now takes an optional name --------
-- New param added with a default so any existing caller still works.

create or replace function public.create_invitation(
  p_company_id uuid,
  p_email text,
  p_role public.company_role,
  p_name text default null
)
returns public.invitations
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name  text := nullif(trim(coalesce(p_name, '')), '');
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

  insert into public.invitations (company_id, email, role, invited_by, invited_name)
  values (p_company_id, v_email, p_role, auth.uid(), v_name)
  returning * into v_invite;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (p_company_id, auth.uid(), 'invitation.created', 'invitation', v_invite.id,
          jsonb_build_object('email', v_email, 'role', p_role, 'name', v_name));

  return v_invite;
end;
$$;

-- ---------- get_invitation: also return the invited name ---------

drop function if exists public.get_invitation(text);

create function public.get_invitation(p_token text)
returns table (
  email text,
  role public.company_role,
  company_name text,
  status public.invite_status,
  is_expired boolean,
  invited_name text
)
language sql security definer stable set search_path = public
as $$
  select i.email,
         i.role,
         c.name as company_name,
         i.status,
         (i.expires_at < now()) as is_expired,
         i.invited_name
  from public.invitations i
  join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

-- ---------- accept_invitation: seed profile name if blank --------
-- When the invitee accepts, if their profile has no name yet, fall
-- back to the name the inviter typed — so they appear correctly in
-- interviews/messages immediately.

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

  -- Seed the member's display name from the invite if they have none.
  if v_invite.invited_name is not null then
    update public.profiles
    set full_name = v_invite.invited_name
    where id = auth.uid()
      and (full_name is null or length(trim(full_name)) = 0);
  end if;

  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (v_invite.company_id, auth.uid(), 'invitation.accepted', 'invitation', v_invite.id,
          jsonb_build_object('email', v_invite.email, 'role', v_invite.role));

  return v_invite.company_id;
end;
$$;
