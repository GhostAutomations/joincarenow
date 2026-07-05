-- ============================================================
-- JOIN CARE NOW — Migration 0154: self-serve company creation
-- Public signup lets a care provider create their own company account. Unlike
-- create_company (founder-only, then a separate admin invite), this creates the
-- company AND makes the signing-up user its admin in one step. SECURITY DEFINER
-- so it can write companies + company_users, but guarded: the caller must be
-- signed in and not already belong to a company (one self-serve company per user).
-- The self-serve flow is gated in the app by the SELF_SERVE_SIGNUP flag until the
-- entity + terms are live. Run AFTER 0153.
-- ============================================================

create or replace function public.self_serve_create_company(
  p_name text,
  p_slug text,
  p_provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_company_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Company name too short'; end if;

  -- One self-serve company per user (prevents hijacking / spam companies).
  if exists (select 1 from public.company_users where user_id = v_uid) then
    raise exception 'You already belong to a company';
  end if;

  insert into public.companies (name, slug, settings)
  values (
    trim(p_name),
    p_slug,
    jsonb_build_object(
      -- Holds the company in the setup/billing gate until activation.
      'setup_complete', false,
      'self_serve', true,
      'signup_source', 'self_serve',
      'provider_ref', nullif(trim(coalesce(p_provider_ref, '')), '')
    )
  )
  returning id into v_company_id;

  insert into public.company_users (company_id, user_id, role)
  values (v_company_id, v_uid, 'admin');

  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, after)
  values (
    v_company_id, v_uid, 'company.self_serve_created', 'company', v_company_id,
    jsonb_build_object('name', p_name, 'slug', p_slug, 'provider_ref', p_provider_ref)
  );

  return v_company_id;
end;
$function$;

grant execute on function public.self_serve_create_company(text, text, text) to authenticated;
