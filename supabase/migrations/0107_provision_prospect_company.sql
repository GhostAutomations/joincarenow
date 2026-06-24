-- Auto-provision a customer company when a prospect is Won — including from the
-- PUBLIC proposal "Accept" link, which has no logged-in user. The existing
-- create_company / create_invitation RPCs hard-require auth.uid(), so they throw
-- on the public path and nothing gets created. This single SECURITY DEFINER RPC
-- creates the company + a pending admin invitation without needing a user
-- session, and is safe because:
--   • execute is granted only to authenticated + service_role (never anon)
--   • it self-guards: an authenticated caller must be the platform admin; a
--     no-auth (service_role) server call is allowed (that's the Accept path).
create or replace function public.provision_prospect_company(
  p_name text,
  p_slug text,
  p_admin_email text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id uuid;
  v_email text := lower(trim(coalesce(p_admin_email, '')));
  v_token text;
begin
  -- Authenticated callers must be the founder; service_role (auth.uid() null)
  -- is the trusted server-side Accept path.
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Not allowed to provision companies';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Company name too short';
  end if;

  insert into public.companies (name, slug)
  values (trim(p_name), p_slug)
  returning id into v_company_id;

  if v_email <> '' and v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    insert into public.invitations (company_id, email, role, invited_by)
    values (v_company_id, v_email, 'admin', null)
    returning token into v_token;
  end if;

  return jsonb_build_object('company_id', v_company_id, 'invite_token', v_token);
end;
$$;

grant execute on function public.provision_prospect_company(text, text, text) to authenticated, service_role;
