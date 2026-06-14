-- Tighten objects flagged by Supabase security advisor without changing the
-- app's server-side data flow.

create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

create or replace function app_private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

create or replace function app_private.coach_has_message_access(target_coach_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.coaches
    where coaches.user_id = target_coach_user_id
      and coaches.admin_premium_access_until > now()
  )
  or exists (
    select 1
    from public.subscriptions
    where subscriptions.coach_user_id = target_coach_user_id
      and subscriptions.status in ('trialing', 'active', 'canceling')
      and coalesce(subscriptions.access_ends_at, subscriptions.current_period_end, subscriptions.trial_ends_at) > now()
  )
  or exists (
    select 1
    from public.premium_access_grants
    where coalesce(premium_access_grants.user_id, premium_access_grants.coach_user_id) = target_coach_user_id
      and premium_access_grants.is_active = true
      and premium_access_grants.starts_at <= now()
      and (premium_access_grants.ends_at is null or premium_access_grants.ends_at > now())
  );
$$;

revoke all on function app_private.current_user_is_admin() from public;
revoke all on function app_private.current_user_is_admin() from anon;
grant execute on function app_private.current_user_is_admin() to authenticated;
grant execute on function app_private.current_user_is_admin() to service_role;

revoke all on function app_private.coach_has_message_access(uuid) from public;
revoke all on function app_private.coach_has_message_access(uuid) from anon;
grant execute on function app_private.coach_has_message_access(uuid) to authenticated;
grant execute on function app_private.coach_has_message_access(uuid) to service_role;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select app_private.current_user_is_admin();
$$;

create or replace function public.coach_has_message_access(target_coach_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    target_coach_user_id is not null
    and (
      auth.uid() = target_coach_user_id
      or auth.role() = 'service_role'
      or app_private.current_user_is_admin()
    )
    and app_private.coach_has_message_access(target_coach_user_id);
$$;

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_admin() from anon;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_is_admin() to service_role;

revoke all on function public.coach_has_message_access(uuid) from public;
revoke all on function public.coach_has_message_access(uuid) from anon;
grant execute on function public.coach_has_message_access(uuid) to authenticated;
grant execute on function public.coach_has_message_access(uuid) to service_role;

drop policy if exists "Coach media is publicly readable" on storage.objects;

do $$
begin
  if to_regclass('public.coach_conversation_safe_metadata') is not null then
    execute 'alter view public.coach_conversation_safe_metadata set (security_invoker = true)';
  end if;
end $$;

do $$
declare
  fn regprocedure;
begin
  foreach fn in array array[
    to_regprocedure('public.handle_new_auth_user()'),
    to_regprocedure('public.increment_participant_unread(uuid,uuid)'),
    to_regprocedure('public.mark_conversation_read(uuid)'),
    to_regprocedure('public.create_training_request(text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,text)'),
    to_regprocedure('public.create_training_request_verified(uuid,text,text,text,text,text,text,text,text,text,text,boolean,boolean,text)'),
    to_regprocedure('public.send_conversation_message(uuid,text)')
  ]
  loop
    if fn is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;
