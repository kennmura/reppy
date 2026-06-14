-- Database-only hardening for account profiles, training requests, messaging,
-- coach availability, premium access, and location search.

create extension if not exists "pgcrypto";

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.coach_has_message_access(target_coach_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

revoke all on function public.coach_has_message_access(uuid) from public;
grant execute on function public.coach_has_message_access(uuid) to authenticated;

alter table public.account_private_details
  add column if not exists player_name text,
  add column if not exists parent_guardian_name text,
  add column if not exists player_date_of_birth date,
  add column if not exists current_club text,
  add column if not exists preferred_location text;

update public.account_private_details private_details
set
  player_name = coalesce(private_details.player_name, preferences.player_name),
  parent_guardian_name = coalesce(private_details.parent_guardian_name, preferences.guardian_name),
  player_date_of_birth = coalesce(private_details.player_date_of_birth, preferences.player_birth_date),
  current_club = coalesce(private_details.current_club, preferences.current_team),
  preferred_location = coalesce(private_details.preferred_location, preferences.location_text),
  updated_at = now()
from public.user_coaching_preferences preferences
where preferences.user_id = private_details.user_id
  and (
    private_details.player_name is null
    or private_details.parent_guardian_name is null
    or private_details.player_date_of_birth is null
    or private_details.current_club is null
    or private_details.preferred_location is null
  );

alter table public.coaches
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists public_location text,
  add column if not exists service_radius_miles integer not null default 30;

update public.coaches
set timezone = 'America/New_York'
where timezone is null;

alter table public.coach_availability_blocks
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists location text;

update public.coach_availability_blocks availability
set coach_user_id = coaches.user_id
from public.coaches
where availability.coach_id = coaches.id
  and availability.coach_user_id is null
  and coaches.user_id is not null;

update public.coach_availability_blocks
set end_time = start_time + interval '1 hour'
where end_time <= start_time;

alter table public.training_requests
  add column if not exists conversation_id uuid,
  add column if not exists requester_user_id uuid references auth.users(id) on delete set null,
  add column if not exists guardian_user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_request_id uuid,
  add column if not exists service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists service_title text,
  add column if not exists service_description text,
  add column if not exists selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  add column if not exists requested_date date,
  add column if not exists requested_start_time time,
  add column if not exists requested_end_time time,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists player_age_at_request integer,
  add column if not exists is_minor boolean default false,
  add column if not exists guardian_required boolean default false,
  add column if not exists guardian_name text,
  add column if not exists guardian_confirmed_at timestamp with time zone,
  add column if not exists parent_follow_up_sent_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_requests_conversation_fk'
      and conrelid = 'public.training_requests'::regclass
  ) then
    alter table public.training_requests
      add constraint training_requests_conversation_fk
      foreign key (conversation_id) references public.conversations(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_requests_requester_client_request_id_key'
      and conrelid = 'public.training_requests'::regclass
  ) then
    begin
      alter table public.training_requests
        add constraint training_requests_requester_client_request_id_key
        unique (requester_user_id, client_request_id);
    exception
      when unique_violation then
        raise notice 'Skipped training_requests_requester_client_request_id_key because duplicate idempotency keys exist.';
    end;
  end if;
end $$;

update public.training_requests
set status = case
  when status in ('pending', 'accepted', 'declined', 'cancelled', 'completed') then status
  when status = 'scheduled' then 'accepted'
  when status = 'closed' then 'completed'
  else 'pending'
end
where status is null
  or status not in ('pending', 'accepted', 'declined', 'cancelled', 'completed');

update public.training_requests
set requested_end_time = null
where requested_start_time is not null
  and requested_end_time is not null
  and requested_end_time <= requested_start_time;

update public.training_requests
set player_age_at_request = null
where player_age_at_request is not null
  and (player_age_at_request < 0 or player_age_at_request > 120);

alter table public.training_requests
  alter column status set default 'pending',
  alter column status set not null;

alter table public.training_requests
  drop constraint if exists training_requests_status_check,
  add constraint training_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'completed')) not valid;

alter table public.training_requests validate constraint training_requests_status_check;

alter table public.training_requests
  drop constraint if exists training_requests_requested_time_check,
  add constraint training_requests_requested_time_check
    check (
      requested_start_time is null
      or requested_end_time is null
      or requested_end_time > requested_start_time
    ) not valid;

alter table public.training_requests validate constraint training_requests_requested_time_check;

alter table public.training_requests
  drop constraint if exists training_requests_player_age_at_request_check,
  add constraint training_requests_player_age_at_request_check
    check (player_age_at_request is null or player_age_at_request between 0 and 120) not valid;

alter table public.training_requests validate constraint training_requests_player_age_at_request_check;

alter table public.coach_availability_blocks
  drop constraint if exists coach_availability_blocks_time_check,
  add constraint coach_availability_blocks_time_check
    check (end_time > start_time) not valid;

alter table public.coach_availability_blocks validate constraint coach_availability_blocks_time_check;

alter table public.conversation_private_details
  add column if not exists service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists service_title text,
  add column if not exists service_description text,
  add column if not exists selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  add column if not exists requested_date date,
  add column if not exists requested_start_time time,
  add column if not exists requested_end_time time,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists player_age_at_request integer,
  add column if not exists current_team text;

create index if not exists account_private_details_player_dob_idx
  on public.account_private_details(player_date_of_birth)
  where player_date_of_birth is not null;
create index if not exists coaches_city_state_idx
  on public.coaches(lower(city), lower(state))
  where city is not null or state is not null;
create index if not exists coaches_zip_code_idx on public.coaches(zip_code);
create index if not exists coaches_coordinates_idx
  on public.coaches(latitude, longitude)
  where latitude is not null and longitude is not null;
create index if not exists coaches_published_sport_idx
  on public.coaches(is_published, sport);
create index if not exists coach_availability_blocks_coach_date_idx
  on public.coach_availability_blocks(coach_id, availability_date, start_time);
create index if not exists coach_availability_blocks_user_date_idx
  on public.coach_availability_blocks(coach_user_id, availability_date);
create index if not exists training_requests_requester_created_idx
  on public.training_requests(requester_user_id, created_at desc);
create index if not exists training_requests_coach_created_idx
  on public.training_requests(coach_id, created_at desc);
create index if not exists training_requests_coach_status_created_idx
  on public.training_requests(coach_id, status, created_at desc);
create index if not exists training_requests_status_idx
  on public.training_requests(status);
create index if not exists training_requests_coach_requested_date_idx
  on public.training_requests(coach_id, requested_date, requested_start_time)
  where requested_date is not null;
drop index if exists public.training_requests_active_requester_coach_idx;
create index training_requests_active_requester_coach_idx
  on public.training_requests(requester_user_id, coach_id, status)
  where status in ('pending', 'accepted');
create index if not exists training_requests_service_idx
  on public.training_requests(service_id);
create index if not exists training_requests_availability_idx
  on public.training_requests(selected_availability_block_id)
  where selected_availability_block_id is not null;
create index if not exists conversations_coach_last_message_idx
  on public.conversations(coach_id, last_message_at desc);
create index if not exists conversations_requester_last_message_idx
  on public.conversations(requester_user_id, last_message_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);
create index if not exists conversation_participants_user_role_idx
  on public.conversation_participants(user_id, role, is_archived);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);
create index if not exists premium_access_grants_user_active_idx
  on public.premium_access_grants(user_id, is_active, starts_at, ends_at);
create index if not exists premium_access_grants_coach_user_active_idx
  on public.premium_access_grants(coach_user_id, is_active, starts_at, ends_at);

alter table public.coaches enable row level security;
alter table public.coach_services enable row level security;
alter table public.coach_audiences enable row level security;
alter table public.coach_testimonials enable row level security;
alter table public.coach_media enable row level security;
alter table public.coach_credentials enable row level security;
alter table public.coach_private_details enable row level security;
alter table public.coach_availability_blocks enable row level security;
alter table public.user_profiles enable row level security;
alter table public.account_private_details enable row level security;
alter table public.user_coaching_preferences enable row level security;
alter table public.training_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_private_details enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.subscriptions enable row level security;
alter table public.premium_access_grants enable row level security;
alter table public.player_records enable row level security;

drop policy if exists "Published coaches are public" on public.coaches;
create policy "Published coaches are public"
on public.coaches for select
using (is_published = true);

drop policy if exists "Coach owners can read own coach profile" on public.coaches;
create policy "Coach owners can read own coach profile"
on public.coaches for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Coach owners can insert own coach profile" on public.coaches;
create policy "Coach owners can insert own coach profile"
on public.coaches for insert
to authenticated
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Coach owners can update own coach profile" on public.coaches;
create policy "Coach owners can update own coach profile"
on public.coaches for update
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Published coach services are public" on public.coach_services;
create policy "Published coach services are public"
on public.coach_services for select
using (
  exists (
    select 1 from public.coaches
    where coaches.id = coach_services.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Coach owners can manage own services" on public.coach_services;
create policy "Coach owners can manage own services"
on public.coach_services for all
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_services.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_services.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Published coach audiences are public" on public.coach_audiences;
create policy "Published coach audiences are public"
on public.coach_audiences for select
using (
  exists (
    select 1 from public.coaches
    where coaches.id = coach_audiences.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Coach owners can manage own audiences" on public.coach_audiences;
create policy "Coach owners can manage own audiences"
on public.coach_audiences for all
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_audiences.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_audiences.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Published coach testimonials are public" on public.coach_testimonials;
create policy "Published coach testimonials are public"
on public.coach_testimonials for select
using (
  exists (
    select 1 from public.coaches
    where coaches.id = coach_testimonials.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Published coach media is public" on public.coach_media;
create policy "Published coach media is public"
on public.coach_media for select
using (
  exists (
    select 1 from public.coaches
    where coaches.id = coach_media.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Coach owners can manage own media rows" on public.coach_media;
create policy "Coach owners can manage own media rows"
on public.coach_media for all
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_media.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin()
  or exists (
    select 1 from public.coaches
    where coaches.id = coach_media.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Published coach availability is public" on public.coach_availability_blocks;
create policy "Published coach availability is public"
on public.coach_availability_blocks for select
using (
  exists (
    select 1
    from public.coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Coaches manage own availability" on public.coach_availability_blocks;
create policy "Coaches manage own availability"
on public.coach_availability_blocks for all
to authenticated
using (
  public.current_user_is_admin()
  or auth.uid() = coach_user_id
  or exists (
    select 1
    from public.coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin()
  or auth.uid() = coach_user_id
  or exists (
    select 1
    from public.coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles for select
to authenticated
using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles for update
to authenticated
using (id = auth.uid() or public.current_user_is_admin())
with check (id = auth.uid() or public.current_user_is_admin());

revoke update (role, account_status, email_verified_at, phone_verified_at, created_at)
on public.user_profiles
from authenticated, anon;

drop policy if exists "Users can read own private account details" on public.account_private_details;
create policy "Users can read own private account details"
on public.account_private_details for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can insert own private account details" on public.account_private_details;
create policy "Users can insert own private account details"
on public.account_private_details for insert
to authenticated
with check (
  user_id = auth.uid()
  and account_type in ('parent', 'adult_player')
);

drop policy if exists "Users can update own private account details" on public.account_private_details;
create policy "Users can update own private account details"
on public.account_private_details for update
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (
  public.current_user_is_admin()
  or (
    user_id = auth.uid()
    and account_type in ('parent', 'adult_player')
  )
);

drop policy if exists "Users can read own coaching preferences" on public.user_coaching_preferences;
create policy "Users can read own coaching preferences"
on public.user_coaching_preferences for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can upsert own coaching preferences" on public.user_coaching_preferences;
create policy "Users can upsert own coaching preferences"
on public.user_coaching_preferences for all
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Requesters can create own training requests" on public.training_requests;
create policy "Requesters can create own training requests"
on public.training_requests for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and coach_id is not null
  and exists (
    select 1
    from public.user_profiles
    where user_profiles.id = auth.uid()
      and user_profiles.role in ('parent', 'adult_player')
      and user_profiles.account_status = 'active'
  )
  and exists (
    select 1
    from public.coaches
    where coaches.id = training_requests.coach_id
      and coaches.is_published = true
      and coalesce(coaches.accepting_requests, true) = true
      and coalesce(coaches.user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  )
);

drop policy if exists "Requesters can read own training requests" on public.training_requests;
create policy "Requesters can read own training requests"
on public.training_requests for select
to authenticated
using (
  requester_user_id = auth.uid()
  or guardian_user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Coaches can read requests sent to them" on public.training_requests;
create policy "Coaches can read requests sent to them"
on public.training_requests for select
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.coaches
    where coaches.id = training_requests.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage training requests" on public.training_requests;
create policy "Admins can manage training requests"
on public.training_requests for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Participants can read own conversations" on public.conversations;
create policy "Participants can read own conversations"
on public.conversations for select
to authenticated
using (
  public.current_user_is_admin()
  or coach_user_id = auth.uid()
  or requester_user_id = auth.uid()
  or guardian_user_id = auth.uid()
  or exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = conversations.id
      and conversation_participants.user_id = auth.uid()
  )
);

drop policy if exists "Requesters can create own conversations" on public.conversations;
create policy "Requesters can create own conversations"
on public.conversations for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and exists (
    select 1
    from public.user_profiles
    where user_profiles.id = auth.uid()
      and user_profiles.role in ('parent', 'adult_player')
      and user_profiles.account_status = 'active'
  )
  and exists (
    select 1
    from public.coaches
    where coaches.id = conversations.coach_id
      and coaches.is_published = true
      and coalesce(coaches.accepting_requests, true) = true
      and coalesce(coaches.user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  )
);

drop policy if exists "Participants can update own conversations" on public.conversations;
create policy "Participants can update own conversations"
on public.conversations for update
to authenticated
using (
  public.current_user_is_admin()
  or coach_user_id = auth.uid()
  or requester_user_id = auth.uid()
  or guardian_user_id = auth.uid()
)
with check (
  public.current_user_is_admin()
  or coach_user_id = auth.uid()
  or requester_user_id = auth.uid()
  or guardian_user_id = auth.uid()
);

drop policy if exists "Users can read own conversation participants" on public.conversation_participants;
create policy "Users can read own conversation participants"
on public.conversation_participants for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Users can insert allowed conversation participants" on public.conversation_participants;
create policy "Users can insert allowed conversation participants"
on public.conversation_participants for insert
to authenticated
with check (
  public.current_user_is_admin()
  or (
    user_id = auth.uid()
    and role in ('parent', 'player', 'guardian')
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_participants.conversation_id
        and (
          conversations.requester_user_id = auth.uid()
          or conversations.guardian_user_id = auth.uid()
        )
    )
  )
  or (
    role = 'coach'
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_participants.conversation_id
        and conversations.requester_user_id = auth.uid()
        and conversations.coach_user_id = conversation_participants.user_id
    )
  )
);

drop policy if exists "Users can update own conversation participants" on public.conversation_participants;
create policy "Users can update own conversation participants"
on public.conversation_participants for update
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Requesters can write own conversation private details" on public.conversation_private_details;
create policy "Requesters can write own conversation private details"
on public.conversation_private_details for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = conversation_private_details.conversation_id
      and conversations.requester_user_id = auth.uid()
  )
);

drop policy if exists "Requesters can read own conversation private details" on public.conversation_private_details;
create policy "Requesters can read own conversation private details"
on public.conversation_private_details for select
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.conversations
    where conversations.id = conversation_private_details.conversation_id
      and (
        conversations.requester_user_id = auth.uid()
        or conversations.guardian_user_id = auth.uid()
      )
  )
);

drop policy if exists "Premium coaches can read own conversation private details" on public.conversation_private_details;
create policy "Premium coaches can read own conversation private details"
on public.conversation_private_details for select
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.conversations
    where conversations.id = conversation_private_details.conversation_id
      and conversations.coach_user_id = auth.uid()
      and public.coach_has_message_access(auth.uid())
  )
);

drop policy if exists "Requesters can read own messages" on public.messages;
create policy "Requesters can read own messages"
on public.messages for select
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = auth.uid()
      and conversation_participants.role <> 'coach'
  )
);

drop policy if exists "Premium coaches can read own messages" on public.messages;
create policy "Premium coaches can read own messages"
on public.messages for select
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.coach_user_id = auth.uid()
      and public.coach_has_message_access(auth.uid())
  )
);

drop policy if exists "Requesters can insert own messages" on public.messages;
create policy "Requesters can insert own messages"
on public.messages for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and sender_role in ('parent', 'player', 'guardian')
  and exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = messages.conversation_id
      and conversation_participants.user_id = auth.uid()
      and conversation_participants.role = messages.sender_role
      and conversation_participants.is_blocked = false
  )
);

drop policy if exists "Premium coaches can insert own messages" on public.messages;
create policy "Premium coaches can insert own messages"
on public.messages for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and sender_role = 'coach'
  and public.coach_has_message_access(auth.uid())
  and exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.coach_user_id = auth.uid()
  )
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can update own notification read state"
on public.notifications for update
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications for delete
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Participants can create conversation notifications" on public.notifications;
create policy "Participants can create conversation notifications"
on public.notifications for insert
to authenticated
with check (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.conversations
    where conversations.id = notifications.related_conversation_id
      and (
        (
          conversations.requester_user_id = auth.uid()
          and notifications.user_id = conversations.coach_user_id
          and notifications.type in ('new_training_request', 'new_message')
        )
        or (
          conversations.coach_user_id = auth.uid()
          and notifications.user_id in (conversations.requester_user_id, conversations.guardian_user_id)
          and notifications.type in ('coach_replied', 'new_message')
        )
      )
  )
);

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
on public.notification_preferences for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can manage own notification preferences" on public.notification_preferences;
create policy "Users can manage own notification preferences"
on public.notification_preferences for all
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Premium coaches can read own subscriptions" on public.subscriptions;
create policy "Premium coaches can read own subscriptions"
on public.subscriptions for select
to authenticated
using (coach_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can read own premium grants" on public.premium_access_grants;
create policy "Users can read own premium grants"
on public.premium_access_grants for select
to authenticated
using (
  public.current_user_is_admin()
  or coach_user_id = auth.uid()
  or user_id = auth.uid()
);

drop policy if exists "Premium coaches can read own player records" on public.player_records;
create policy "Premium coaches can read own player records"
on public.player_records for select
to authenticated
using (
  public.current_user_is_admin()
  or (
    coach_user_id = auth.uid()
    and public.coach_has_message_access(auth.uid())
  )
);

drop policy if exists "Premium coaches can manage own player records" on public.player_records;
create policy "Premium coaches can manage own player records"
on public.player_records for all
to authenticated
using (
  public.current_user_is_admin()
  or (
    coach_user_id = auth.uid()
    and public.coach_has_message_access(auth.uid())
  )
)
with check (
  public.current_user_is_admin()
  or (
    coach_user_id = auth.uid()
    and public.coach_has_message_access(auth.uid())
  )
);
