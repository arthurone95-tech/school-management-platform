-- Migration: 20261011000002_portal_signup_guard
--
-- Auth Hook ("Before User Created") required by D-020.
--
-- Supabase Auth accepts identities by email, phone, OAuth or SAML. Student
-- accounts therefore use an internal, non-deliverable identifier in the
-- reserved `students.invalid` namespace. That namespace must be reserved: only
-- the platform server may create accounts, and public self-sign-up must be
-- refused.
--
-- GoTrue cannot be told "reserved domain" directly, so this hook refuses any
-- creation that was not performed by the platform server. The server stamps an
-- un-forgeable marker into `app_metadata` (`provisioned_by`). Public sign-up and
-- OAuth cannot set `app_metadata`, so they are refused; the service-role server
-- can, so it is allowed. This is defence in depth behind a disabled public
-- sign-up setting.
--
-- The hook is a Postgres function invoked by GoTrue; enabling it is a project
-- setting, not DDL (see docs/PHASE0_RISK_REGISTER.md 10.4).

create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker text;
begin
  v_marker := event -> 'user' -> 'app_metadata' ->> 'provisioned_by';

  if v_marker = 'school-platform' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message',
        'Sign-up is not available. Ask your school administrator to create your account.',
      'http_code', 403
    )
  );
end;
$$;

comment on function public.before_user_created(jsonb) is
  'Auth Hook (before user created): allows account creation only when the platform server has stamped app_metadata.provisioned_by. Refuses public sign-up and any other path, protecting the reserved students.invalid identity namespace.';

revoke all on function public.before_user_created(jsonb)
  from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb)
  to supabase_auth_admin;
