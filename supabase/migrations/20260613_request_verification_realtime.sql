create extension if not exists "pgcrypto";

create table if not exists public.account_private_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text,
  phone_verified_at timestamp with time zone,
  account_type text,
  otp_send_count integer not null default 0,
  otp_verify_attempt_count integer not null default 0,
  otp_last_sent_at timestamp with time zone,
  otp_window_started_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint account_private_details_account_type_check
    check (account_type is null or account_type in ('parent', 'adult_player'))
);

alter table public.user_profiles
  add column if not exists phone_verified_at timestamp with time zone;

alter table public.training_requests
  add column if not exists client_request_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'training_requests_requester_client_request_id_key'
  ) then
    alter table public.training_requests
      add constraint training_requests_requester_client_request_id_key
      unique (requester_user_id, client_request_id);
  end if;
end $$;

create index if not exists account_private_details_phone_idx
  on public.account_private_details(phone_e164)
  where phone_e164 is not null;

create index if not exists training_requests_requester_created_idx
  on public.training_requests(requester_user_id, created_at desc);

create index if not exists training_requests_active_requester_coach_idx
  on public.training_requests(requester_user_id, coach_id, status)
  where status in ('new', 'contacted', 'scheduled');

alter table public.account_private_details enable row level security;

drop policy if exists "Users can read own private account details" on public.account_private_details;
create policy "Users can read own private account details"
on public.account_private_details for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can update own private account details" on public.account_private_details;
create policy "Users can update own private account details"
on public.account_private_details for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can insert own private account details" on public.account_private_details;
create policy "Users can insert own private account details"
on public.account_private_details for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.create_training_request_verified(
  p_client_request_id uuid,
  p_coach_slug text,
  p_requester_display_name text,
  p_player_age text,
  p_age_range text,
  p_current_level text,
  p_training_goals text,
  p_preferred_location text,
  p_general_location text,
  p_preferred_days_times text,
  p_guardian_name text,
  p_is_minor boolean,
  p_guardian_confirmed boolean,
  p_first_message text
)
returns table(request_id uuid, conversation_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  requester_profile public.user_profiles%rowtype;
  requester_private public.account_private_details%rowtype;
  target_coach public.coaches%rowtype;
  existing_request public.training_requests%rowtype;
  new_conversation_id uuid;
  new_request_id uuid;
  request_type text;
  requester_email text;
begin
  if requester_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_client_request_id is null then
    raise exception 'VALIDATION_ERROR: missing client request id';
  end if;

  select * into requester_profile
  from public.user_profiles
  where id = requester_id;

  if requester_profile.id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if requester_profile.account_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;

  if requester_profile.role not in ('parent', 'adult_player') then
    raise exception 'WRONG_ROLE';
  end if;

  if requester_profile.email_verified_at is null then
    raise exception 'EMAIL_NOT_VERIFIED';
  end if;

  select * into requester_private
  from public.account_private_details
  where user_id = requester_id;

  if requester_private.phone_verified_at is null then
    raise exception 'PHONE_NOT_VERIFIED';
  end if;

  select * into existing_request
  from public.training_requests
  where requester_user_id = requester_id
    and client_request_id = p_client_request_id
  limit 1;

  if existing_request.id is not null then
    request_id := existing_request.id;
    conversation_id := existing_request.conversation_id;
    was_existing := true;
    return next;
    return;
  end if;

  select * into target_coach
  from public.coaches
  where slug = p_coach_slug
    and is_published = true
    and coalesce(accepting_requests, true) = true
  limit 1;

  if target_coach.id is null then
    raise exception 'COACH_UNAVAILABLE';
  end if;

  if target_coach.user_id = requester_id then
    raise exception 'SELF_REQUEST_FORBIDDEN';
  end if;

  if exists (
    select 1 from public.training_requests
    where requester_user_id = requester_id
      and created_at > now() - interval '1 hour'
    limit 5
    offset 4
  ) then
    raise exception 'RATE_LIMITED';
  end if;

  if exists (
    select 1 from public.training_requests
    where requester_user_id = requester_id
      and coach_id = target_coach.id
      and status in ('new', 'contacted', 'scheduled')
      and created_at > now() - interval '7 days'
  ) then
    raise exception 'ACTIVE_DUPLICATE';
  end if;

  request_type := coalesce(nullif(p_current_level, ''), target_coach.category, 'Training request');

  insert into public.conversations (
    coach_id,
    coach_user_id,
    requester_user_id,
    sport,
    request_type,
    age_range,
    general_location,
    status,
    is_unread_by_coach,
    retention_expires_at,
    last_message_at
  )
  values (
    target_coach.id,
    target_coach.user_id,
    requester_id,
    coalesce(target_coach.sport, 'Training'),
    request_type,
    p_age_range,
    p_general_location,
    'new',
    true,
    now() + interval '90 days',
    now()
  )
  returning id into new_conversation_id;

  if target_coach.user_id is not null then
    insert into public.conversation_participants (conversation_id, user_id, role, unread_count)
    values (new_conversation_id, target_coach.user_id, 'coach', 1)
    on conflict (conversation_id, user_id, role) do nothing;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role, unread_count, last_read_at)
  values (new_conversation_id, requester_id, 'parent', 0, now())
  on conflict (conversation_id, user_id, role) do nothing;

  requester_email := coalesce((auth.jwt() ->> 'email'), '');

  insert into public.conversation_private_details (
    conversation_id,
    requester_display_name,
    requester_email,
    requester_phone,
    guardian_name,
    exact_location,
    preferred_days_times,
    current_level
  )
  values (
    new_conversation_id,
    p_requester_display_name,
    requester_email,
    requester_private.phone_e164,
    p_guardian_name,
    p_preferred_location,
    p_preferred_days_times,
    p_current_level
  );

  insert into public.messages (conversation_id, sender_user_id, sender_role, body)
  values (new_conversation_id, requester_id, 'parent', p_first_message);

  insert into public.training_requests (
    coach_id,
    coach_slug,
    conversation_id,
    requester_user_id,
    client_request_id,
    name,
    email,
    phone,
    player_age,
    current_level,
    training_goals,
    preferred_location,
    preferred_days_times,
    status,
    is_minor,
    guardian_required,
    guardian_name,
    guardian_confirmed_at
  )
  values (
    target_coach.id,
    target_coach.slug,
    new_conversation_id,
    requester_id,
    p_client_request_id,
    p_requester_display_name,
    requester_email,
    null,
    p_player_age,
    p_current_level,
    p_training_goals,
    p_preferred_location,
    p_preferred_days_times,
    'new',
    p_is_minor,
    p_is_minor,
    p_guardian_name,
    case when p_guardian_confirmed then now() else null end
  )
  returning id into new_request_id;

  if target_coach.user_id is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      related_conversation_id,
      action_url,
      is_read
    )
    values (
      target_coach.user_id,
      'new_training_request',
      case
        when public.coach_has_message_access(target_coach.user_id) then 'New training request'
        else 'New training request waiting'
      end,
      case
        when public.coach_has_message_access(target_coach.user_id) then 'A new request is waiting in your Message Centre.'
        else 'Open your Message Centre to view the locked request.'
      end,
      new_conversation_id,
      '/coach/messages/' || new_conversation_id::text,
      false
    );
  end if;

  request_id := new_request_id;
  conversation_id := new_conversation_id;
  was_existing := false;
  return next;
end;
$$;
