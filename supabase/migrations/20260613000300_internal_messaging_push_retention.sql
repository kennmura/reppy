create extension if not exists "pgcrypto";

alter table conversations
  alter column retention_expires_at set default (now() + interval '90 days');

alter table conversations add column if not exists free_coach_alert_sent_at timestamp with time zone;
alter table conversations add column if not exists free_coach_alert_attempted_at timestamp with time zone;
alter table conversations add column if not exists free_coach_alert_error text;
alter table conversations add column if not exists retention_processed_at timestamp with time zone;
alter table conversations add column if not exists legal_hold_until timestamp with time zone;

update conversations
set retention_expires_at = coalesce(last_message_at, updated_at, created_at, now()) + interval '90 days'
where is_saved = false
  and retention_processed_at is null
  and (
    retention_expires_at is null
    or retention_expires_at > coalesce(last_message_at, updated_at, created_at, now()) + interval '90 days'
  );

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('coach', 'parent', 'player', 'guardian')),
  last_read_at timestamp with time zone,
  unread_count integer not null default 0 check (unread_count >= 0),
  is_archived boolean not null default false,
  is_muted boolean not null default false,
  is_blocked boolean not null default false,
  joined_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (conversation_id, user_id, role)
);

insert into conversation_participants (conversation_id, user_id, role, unread_count, joined_at, updated_at)
select id, coach_user_id, 'coach', case when is_unread_by_coach then 1 else 0 end, created_at, now()
from conversations
where coach_user_id is not null
on conflict (conversation_id, user_id, role) do nothing;

insert into conversation_participants (conversation_id, user_id, role, unread_count, joined_at, updated_at)
select id, requester_user_id, 'parent', 0, created_at, now()
from conversations
where requester_user_id is not null
on conflict (conversation_id, user_id, role) do nothing;

insert into conversation_participants (conversation_id, user_id, role, unread_count, joined_at, updated_at)
select id, guardian_user_id, 'guardian', 0, created_at, now()
from conversations
where guardian_user_id is not null
on conflict (conversation_id, user_id, role) do nothing;

alter table notifications add column if not exists action_url text;
alter table notifications add column if not exists is_read boolean not null default false;
update notifications set is_read = true where read_at is not null;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  device_label text,
  is_active boolean not null default true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  free_coach_email_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists conversation_participants_user_idx on conversation_participants(user_id, unread_count);
create index if not exists conversation_participants_conversation_idx on conversation_participants(conversation_id);
create index if not exists notifications_user_unread_idx on notifications(user_id, is_read, created_at desc);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id, is_active);
create index if not exists conversations_retention_active_idx
  on conversations(retention_expires_at)
  where is_saved = false and retention_processed_at is null;

alter table conversation_participants enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;

drop policy if exists "Users can read own conversation participants" on conversation_participants;
create policy "Users can read own conversation participants"
on conversation_participants for select
using (user_id = auth.uid());

drop policy if exists "Users can update own conversation participants" on conversation_participants;
create policy "Users can update own conversation participants"
on conversation_participants for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read own notifications" on notifications;
create policy "Users can read own notifications"
on notifications for select
using (user_id = auth.uid());

drop policy if exists "Users can update own notification read state" on notifications;
create policy "Users can update own notification read state"
on notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own notifications" on notifications;
create policy "Users can delete own notifications"
on notifications for delete
using (user_id = auth.uid());

drop policy if exists "Users can read own push subscriptions" on push_subscriptions;
create policy "Users can read own push subscriptions"
on push_subscriptions for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own push subscriptions" on push_subscriptions;
create policy "Users can insert own push subscriptions"
on push_subscriptions for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own push subscriptions" on push_subscriptions;
create policy "Users can update own push subscriptions"
on push_subscriptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read own notification preferences" on notification_preferences;
create policy "Users can read own notification preferences"
on notification_preferences for select
using (user_id = auth.uid());

drop policy if exists "Users can manage own notification preferences" on notification_preferences;
create policy "Users can manage own notification preferences"
on notification_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.increment_participant_unread(
  target_conversation_id uuid,
  target_user_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update conversation_participants
  set unread_count = unread_count + 1,
      updated_at = now()
  where conversation_id = target_conversation_id
    and user_id = target_user_id
    and is_muted = false
    and is_blocked = false;
$$;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
  set unread_count = 0,
      last_read_at = now(),
      updated_at = now()
  where conversation_id = target_conversation_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.create_training_request(
  p_coach_slug text,
  p_requester_display_name text,
  p_requester_email text,
  p_requester_phone text,
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  target_coach coaches%rowtype;
  new_conversation_id uuid;
  request_type text;
begin
  if requester_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into target_coach
  from coaches
  where slug = p_coach_slug
    and is_published = true
    and coalesce(accepting_requests, true) = true
  limit 1;

  if target_coach.id is null then
    raise exception 'Coach is not accepting requests.';
  end if;

  request_type := coalesce(nullif(p_current_level, ''), target_coach.category, 'Training request');

  insert into conversations (
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
    insert into conversation_participants (conversation_id, user_id, role, unread_count)
    values (new_conversation_id, target_coach.user_id, 'coach', 1)
    on conflict (conversation_id, user_id, role) do nothing;
  end if;

  insert into conversation_participants (conversation_id, user_id, role, unread_count, last_read_at)
  values (new_conversation_id, requester_id, 'parent', 0, now())
  on conflict (conversation_id, user_id, role) do nothing;

  insert into conversation_private_details (
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
    p_requester_email,
    p_requester_phone,
    p_guardian_name,
    p_preferred_location,
    p_preferred_days_times,
    p_current_level
  );

  insert into messages (conversation_id, sender_user_id, sender_role, body)
  values (new_conversation_id, requester_id, 'parent', p_first_message);

  insert into training_requests (
    coach_id,
    coach_slug,
    conversation_id,
    requester_user_id,
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
    p_requester_display_name,
    p_requester_email,
    p_requester_phone,
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
  );

  if target_coach.user_id is not null then
    insert into notifications (
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

  return new_conversation_id;
end;
$$;

create or replace function public.send_conversation_message(
  target_conversation_id uuid,
  message_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_id uuid := auth.uid();
  sender_participant conversation_participants%rowtype;
  target_conversation conversations%rowtype;
  new_message_id uuid;
  recipient record;
begin
  if sender_id is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into sender_participant
  from conversation_participants
  where conversation_id = target_conversation_id
    and user_id = sender_id
    and is_blocked = false
  limit 1;

  if sender_participant.id is null then
    raise exception 'Conversation not found.';
  end if;

  select * into target_conversation from conversations where id = target_conversation_id;

  if sender_participant.role = 'coach'
    and not public.coach_has_message_access(sender_id) then
    raise exception 'Premium Message Centre access is required.';
  end if;

  insert into messages (conversation_id, sender_user_id, sender_role, body)
  values (target_conversation_id, sender_id, sender_participant.role, message_body)
  returning id into new_message_id;

  update conversations
  set last_message_at = now(),
      retention_expires_at = now() + interval '90 days',
      status = case when sender_participant.role = 'coach' then 'replied' else status end,
      updated_at = now()
  where id = target_conversation_id;

  update conversation_participants
  set unread_count = 0,
      last_read_at = now(),
      updated_at = now()
  where conversation_id = target_conversation_id
    and user_id = sender_id;

  for recipient in
    select * from conversation_participants
    where conversation_id = target_conversation_id
      and user_id <> sender_id
      and is_blocked = false
  loop
    update conversation_participants
    set unread_count = unread_count + 1,
        updated_at = now()
    where id = recipient.id
      and is_muted = false;

    insert into notifications (
      user_id,
      type,
      title,
      body,
      related_conversation_id,
      action_url,
      is_read
    )
    values (
      recipient.user_id,
      case when sender_participant.role = 'coach' then 'coach_replied' else 'new_message' end,
      case when sender_participant.role = 'coach' then 'Your coach replied' else 'New message in Reppy' end,
      'Open Reppy to view it.',
      target_conversation_id,
      case when recipient.role = 'coach'
        then '/coach/messages/' || target_conversation_id::text
        else '/account/messages/' || target_conversation_id::text
      end,
      false
    );
  end loop;

  return new_message_id;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['notifications', 'conversation_participants', 'messages', 'conversations']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
