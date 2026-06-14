create extension if not exists "pgcrypto";

create table if not exists coaches (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  full_name text not null,
  email text,
  phone text,
  sport text,
  category text,
  headline text,
  bio text,
  location text,
  city text,
  state text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  timezone text default 'America/New_York',
  service_area text,
  pricing_text text default 'Pricing available upon request.',
  profile_photo_url text,
  banner_image_url text,
  instagram_url text,
  video_url text,
  booking_url text,
  is_published boolean default false,
  is_featured boolean default false,
  subscription_status text default 'manual',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists coach_services (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  title text not null,
  description text,
  duration text,
  price text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists coach_audiences (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists coach_testimonials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  quote text not null,
  author text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists coach_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete cascade,
  availability_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coach_availability_blocks_time_check check (end_time > start_time)
);

create table if not exists coach_media (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  media_url text not null,
  media_type text default 'image',
  caption text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists training_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete set null,
  coach_slug text,
  name text not null,
  email text not null,
  phone text,
  player_age text,
  player_age_at_request integer,
  current_level text,
  training_goals text not null,
  preferred_location text,
  preferred_days_times text,
  message text,
  status text default 'new',
  client_request_id uuid,
  selected_availability_block_id uuid references coach_availability_blocks(id) on delete set null,
  requested_date date,
  requested_start_time time,
  requested_end_time time,
  timezone text default 'America/New_York',
  created_at timestamp with time zone default now()
);

create table if not exists coach_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  sport text not null,
  location text not null,
  coaching_focus text,
  background text not null,
  message text,
  status text default 'new',
  created_at timestamp with time zone default now()
);

insert into storage.buckets (id, name, public)
values ('coach-media', 'coach-media', true)
on conflict (id) do update set public = excluded.public;

alter table coaches enable row level security;
alter table coach_services enable row level security;
alter table coach_audiences enable row level security;
alter table coach_testimonials enable row level security;
alter table coach_availability_blocks enable row level security;
alter table coach_media enable row level security;
alter table training_requests enable row level security;
alter table coach_applications enable row level security;

drop policy if exists "Published coaches are public" on coaches;
create policy "Published coaches are public"
on coaches for select
using (is_published = true);

drop policy if exists "Published coach services are public" on coach_services;
create policy "Published coach services are public"
on coach_services for select
using (exists (select 1 from coaches where coaches.id = coach_services.coach_id and coaches.is_published = true));

drop policy if exists "Published coach audiences are public" on coach_audiences;
create policy "Published coach audiences are public"
on coach_audiences for select
using (exists (select 1 from coaches where coaches.id = coach_audiences.coach_id and coaches.is_published = true));

drop policy if exists "Published coach testimonials are public" on coach_testimonials;
create policy "Published coach testimonials are public"
on coach_testimonials for select
using (exists (select 1 from coaches where coaches.id = coach_testimonials.coach_id and coaches.is_published = true));

drop policy if exists "Published coach availability is public" on coach_availability_blocks;
create policy "Published coach availability is public"
on coach_availability_blocks for select
using (exists (select 1 from coaches where coaches.id = coach_availability_blocks.coach_id and coaches.is_published = true));

drop policy if exists "Coaches manage own availability" on coach_availability_blocks;
create policy "Coaches manage own availability"
on coach_availability_blocks for all
using (
  auth.uid() = coach_user_id
  or exists (select 1 from coaches where coaches.id = coach_availability_blocks.coach_id and coaches.user_id = auth.uid())
)
with check (
  auth.uid() = coach_user_id
  or exists (select 1 from coaches where coaches.id = coach_availability_blocks.coach_id and coaches.user_id = auth.uid())
);

drop policy if exists "Published coach media is public" on coach_media;
create policy "Published coach media is public"
on coach_media for select
using (exists (select 1 from coaches where coaches.id = coach_media.coach_id and coaches.is_published = true));

create index if not exists coaches_slug_idx on coaches(slug);
create index if not exists coach_availability_blocks_coach_date_idx on coach_availability_blocks(coach_id, availability_date, start_time);
create index if not exists coach_availability_blocks_user_date_idx on coach_availability_blocks(coach_user_id, availability_date);
create index if not exists training_requests_status_idx on training_requests(status);
create index if not exists training_requests_created_at_idx on training_requests(created_at desc);
create index if not exists training_requests_requester_created_idx on training_requests(requester_user_id, created_at desc);
create index if not exists coach_applications_status_idx on coach_applications(status);
create index if not exists coach_applications_created_at_idx on coach_applications(created_at desc);

drop policy if exists "Coach media is publicly readable" on storage.objects;
create policy "Coach media is publicly readable"
on storage.objects for select
using (bucket_id = 'coach-media');

alter table coaches add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table coaches add column if not exists accepting_requests boolean default true;
alter table coaches add column if not exists profile_status text default 'published';
alter table coaches add column if not exists founding_price_locked boolean default false;
alter table coaches add column if not exists contact_scan_status text default 'clear';
alter table coaches add column if not exists admin_premium_access_until timestamp with time zone;
alter table coaches add column if not exists referral_code text unique;
alter table coaches add column if not exists city text;
alter table coaches add column if not exists state text;
alter table coaches add column if not exists zip_code text;
alter table coaches add column if not exists latitude double precision;
alter table coaches add column if not exists longitude double precision;
alter table coaches add column if not exists timezone text default 'America/New_York';

alter table training_requests add column if not exists conversation_id uuid;
alter table training_requests add column if not exists requester_user_id uuid references auth.users(id) on delete set null;
alter table training_requests add column if not exists guardian_user_id uuid references auth.users(id) on delete set null;
alter table training_requests add column if not exists is_minor boolean default false;
alter table training_requests add column if not exists guardian_name text;
alter table training_requests add column if not exists guardian_required boolean default false;
alter table training_requests add column if not exists guardian_confirmed_at timestamp with time zone;
alter table training_requests add column if not exists parent_follow_up_sent_at timestamp with time zone;
alter table training_requests add column if not exists client_request_id uuid;
alter table training_requests add column if not exists service_id uuid references coach_services(id) on delete set null;
alter table training_requests add column if not exists service_title text;
alter table training_requests add column if not exists service_description text;
alter table training_requests add column if not exists player_age_at_request integer;
alter table training_requests add column if not exists selected_availability_block_id uuid references coach_availability_blocks(id) on delete set null;
alter table training_requests add column if not exists requested_date date;
alter table training_requests add column if not exists requested_start_time time;
alter table training_requests add column if not exists requested_end_time time;
alter table training_requests add column if not exists timezone text default 'America/New_York';
alter table training_requests add column if not exists updated_at timestamp with time zone default now();

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'parent',
  display_name text,
  email_verified_at timestamp with time zone,
  phone_verified_at timestamp with time zone,
  account_status text default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint user_profiles_role_check check (role in ('coach', 'parent', 'adult_player', 'admin')),
  constraint user_profiles_account_status_check check (account_status in ('active', 'pending', 'suspended', 'banned', 'deleted'))
);

create table if not exists account_private_details (
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

create table if not exists user_coaching_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text,
  guardian_name text,
  player_age text,
  player_birth_date date,
  current_team text,
  contact_notes text,
  sport text,
  location_text text,
  latitude double precision,
  longitude double precision,
  search_radius_miles integer,
  age_group text,
  skill_level text,
  position text,
  training_goals text,
  price_min integer,
  price_max integer,
  training_format text,
  preferred_days text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table user_coaching_preferences add column if not exists player_name text;
alter table user_coaching_preferences add column if not exists guardian_name text;
alter table user_coaching_preferences add column if not exists player_age text;
alter table user_coaching_preferences add column if not exists player_birth_date date;
alter table user_coaching_preferences add column if not exists current_team text;
alter table user_coaching_preferences add column if not exists contact_notes text;

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid references auth.users(id) on delete cascade,
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text default 'free',
  status text default 'free',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean default false,
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  access_ends_at timestamp with time zone,
  founding_price_locked boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  guardian_user_id uuid references auth.users(id) on delete set null,
  sport text,
  request_type text,
  age_range text,
  general_location text,
  status text default 'new',
  is_unread_by_coach boolean default true,
  is_saved boolean default false,
  saved_at timestamp with time zone,
  saved_by_user_id uuid references auth.users(id) on delete set null,
  retention_expires_at timestamp with time zone default (now() + interval '90 days'),
  free_coach_alert_sent_at timestamp with time zone,
  free_coach_alert_attempted_at timestamp with time zone,
  free_coach_alert_error text,
  retention_processed_at timestamp with time zone,
  legal_hold_until timestamp with time zone,
  parent_follow_up_sent_at timestamp with time zone,
  last_message_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_requests_conversation_fk'
  ) then
    alter table training_requests
      add constraint training_requests_conversation_fk
      foreign key (conversation_id) references conversations(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'training_requests_requester_client_request_id_key'
  ) then
    alter table training_requests
      add constraint training_requests_requester_client_request_id_key
      unique (requester_user_id, client_request_id);
  end if;
end $$;

create table if not exists conversation_private_details (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  requester_display_name text,
  requester_email text,
  requester_phone text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  service_id uuid references coach_services(id) on delete set null,
  service_title text,
  service_description text,
  exact_location text,
  preferred_days_times text,
  current_level text
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamp with time zone default now(),
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone
);

create table if not exists contact_share_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  shared_by_user_id uuid references auth.users(id) on delete set null,
  shared_fields text[] not null default '{}',
  shared_values jsonb not null default '{}'::jsonb,
  consented_at timestamp with time zone default now(),
  revoked_at timestamp with time zone
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

create table if not exists player_records (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid references auth.users(id) on delete cascade,
  coach_id uuid references coaches(id) on delete cascade,
  source_conversation_id uuid references conversations(id) on delete set null,
  player_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  birth_date date,
  birth_year integer,
  sport text,
  position text,
  current_level text,
  current_team text,
  training_goals text,
  coach_notes text,
  first_session_date date,
  last_session_date date,
  session_count integer default 0,
  status text default 'prospective',
  guardian_involved boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  reported_by_user_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text,
  details text,
  status text default 'new',
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_coach_user_id uuid references auth.users(id) on delete cascade,
  referred_coach_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text default 'pending',
  qualified_at timestamp with time zone,
  rewarded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists premium_access_grants (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid references auth.users(id) on delete cascade,
  grant_type text not null,
  starts_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone not null,
  referral_id uuid references referrals(id) on delete set null,
  created_at timestamp with time zone default now()
);

create table if not exists banned_identifiers (
  id uuid primary key default gen_random_uuid(),
  identifier_type text not null,
  identifier_hash text not null,
  banned_user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_conversation_id uuid references conversations(id) on delete cascade,
  action_url text,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

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

create table if not exists moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  reason text,
  created_at timestamp with time zone default now()
);

create or replace view coach_conversation_safe_metadata as
select
  id,
  coach_id,
  coach_user_id,
  sport,
  request_type,
  age_range,
  general_location,
  status,
  is_unread_by_coach,
  is_saved,
  parent_follow_up_sent_at,
  last_message_at,
  created_at,
  updated_at
from conversations;

alter table user_profiles enable row level security;
alter table account_private_details enable row level security;
alter table subscriptions enable row level security;
alter table conversations enable row level security;
alter table conversation_private_details enable row level security;
alter table user_coaching_preferences enable row level security;
alter table messages enable row level security;
alter table contact_share_events enable row level security;
alter table conversation_participants enable row level security;
alter table player_records enable row level security;
alter table message_reports enable row level security;
alter table referrals enable row level security;
alter table premium_access_grants enable row level security;
alter table banned_identifiers enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_preferences enable row level security;
alter table moderation_logs enable row level security;

create index if not exists coaches_user_id_idx on coaches(user_id);
create index if not exists coaches_zip_code_idx on coaches(zip_code);
create index if not exists coaches_coordinates_idx on coaches(latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists conversations_coach_id_idx on conversations(coach_id);
create index if not exists conversations_coach_unread_idx on conversations(coach_id, is_unread_by_coach);
create index if not exists conversations_retention_idx on conversations(retention_expires_at) where is_saved = false;
create index if not exists conversation_participants_user_idx on conversation_participants(user_id, unread_count);
create index if not exists conversation_participants_conversation_idx on conversation_participants(conversation_id);
create index if not exists messages_conversation_id_idx on messages(conversation_id);
create index if not exists notifications_user_unread_idx on notifications(user_id, is_read, created_at desc);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id, is_active);
create index if not exists player_records_coach_id_idx on player_records(coach_id);
create index if not exists subscriptions_coach_user_id_idx on subscriptions(coach_user_id);
create index if not exists premium_access_grants_coach_user_id_idx on premium_access_grants(coach_user_id);
create index if not exists account_private_details_phone_idx
  on account_private_details(phone_e164)
  where phone_e164 is not null;
create index if not exists training_requests_service_idx on training_requests(service_id);

create or replace function public.coach_has_message_access(target_coach_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from coaches
    where coaches.user_id = target_coach_user_id
      and coaches.admin_premium_access_until > now()
  )
  or exists (
    select 1
    from subscriptions
    where subscriptions.coach_user_id = target_coach_user_id
      and subscriptions.status in ('trialing', 'active', 'canceling')
      and coalesce(subscriptions.access_ends_at, subscriptions.current_period_end, subscriptions.trial_ends_at) > now()
  )
  or exists (
    select 1
    from premium_access_grants
    where premium_access_grants.coach_user_id = target_coach_user_id
      and premium_access_grants.starts_at <= now()
      and premium_access_grants.ends_at > now()
  );
$$;

drop policy if exists "Users can read own profile" on user_profiles;
create policy "Users can read own profile"
on user_profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on user_profiles;
create policy "Users can update own profile"
on user_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can read own private account details" on account_private_details;
create policy "Users can read own private account details"
on account_private_details for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can update own private account details" on account_private_details;
create policy "Users can update own private account details"
on account_private_details for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can insert own private account details" on account_private_details;
create policy "Users can insert own private account details"
on account_private_details for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can read own coaching preferences" on user_coaching_preferences;
create policy "Users can read own coaching preferences"
on user_coaching_preferences for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can upsert own coaching preferences" on user_coaching_preferences;
create policy "Users can upsert own coaching preferences"
on user_coaching_preferences for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Coaches can read own safe conversation metadata" on conversations;
create policy "Coaches can read own safe conversation metadata"
on conversations for select
using (coach_user_id = auth.uid());

drop policy if exists "Requesters can read own conversations" on conversations;
create policy "Requesters can read own conversations"
on conversations for select
using (requester_user_id = auth.uid() or guardian_user_id = auth.uid());

drop policy if exists "Premium coaches can read own messages" on messages;
create policy "Premium coaches can read own messages"
on messages for select
using (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.coach_user_id = auth.uid()
      and public.coach_has_message_access(auth.uid())
  )
);

drop policy if exists "Requesters can read own messages" on messages;
create policy "Requesters can read own messages"
on messages for select
using (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and (conversations.requester_user_id = auth.uid() or conversations.guardian_user_id = auth.uid())
  )
);

drop policy if exists "Premium coaches can insert own messages" on messages;
create policy "Premium coaches can insert own messages"
on messages for insert
with check (
  sender_user_id = auth.uid()
  and sender_role = 'coach'
  and exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.coach_user_id = auth.uid()
      and public.coach_has_message_access(auth.uid())
  )
);

drop policy if exists "Premium coaches can read own player records" on player_records;
create policy "Premium coaches can read own player records"
on player_records for select
using (coach_user_id = auth.uid() and public.coach_has_message_access(auth.uid()));

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

drop policy if exists "Users can read own conversation participants" on conversation_participants;
create policy "Users can read own conversation participants"
on conversation_participants for select
using (user_id = auth.uid());

drop policy if exists "Users can update own conversation participants" on conversation_participants;
create policy "Users can update own conversation participants"
on conversation_participants for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

alter table coaches add column if not exists public_location text;
alter table coaches add column if not exists service_radius_miles integer not null default 30;

create index if not exists coaches_zip_code_idx on coaches(zip_code);
create index if not exists coaches_lat_lng_idx on coaches(latitude, longitude);
create index if not exists coaches_sport_idx on coaches(sport);
create index if not exists coaches_is_published_idx on coaches(is_published);

alter table premium_access_grants alter column ends_at drop not null;
alter table premium_access_grants add column if not exists coach_id uuid references coaches(id) on delete cascade;
alter table premium_access_grants add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table premium_access_grants add column if not exists granted_by uuid references auth.users(id) on delete set null;
alter table premium_access_grants add column if not exists is_active boolean not null default true;
alter table premium_access_grants add column if not exists notes text;

create table if not exists saved_coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  notes text,
  created_at timestamp with time zone not null default now(),
  unique (user_id, coach_id)
);

create table if not exists coach_reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  headline text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'reported', 'hidden')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  published_at timestamp with time zone
);

create table if not exists coach_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references coach_reviews(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists coach_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references coach_reviews(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone
);

alter table saved_coaches enable row level security;
alter table coach_reviews enable row level security;
alter table coach_review_replies enable row level security;
alter table coach_review_reports enable row level security;

drop policy if exists "Users can read own saved coaches" on saved_coaches;
create policy "Users can read own saved coaches"
on saved_coaches for select
using (user_id = auth.uid());

drop policy if exists "Users can save coaches" on saved_coaches;
create policy "Users can save coaches"
on saved_coaches for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own saved coaches" on saved_coaches;
create policy "Users can update own saved coaches"
on saved_coaches for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own saved coaches" on saved_coaches;
create policy "Users can delete own saved coaches"
on saved_coaches for delete
using (user_id = auth.uid());

drop policy if exists "Approved reviews are public" on coach_reviews;
create policy "Approved reviews are public"
on coach_reviews for select
using (status = 'approved');

drop policy if exists "Users can insert own reviews" on coach_reviews;
create policy "Users can insert own reviews"
on coach_reviews for insert
with check (reviewer_user_id = auth.uid());

drop policy if exists "Approved review replies are public" on coach_review_replies;
create policy "Approved review replies are public"
on coach_review_replies for select
using (status = 'approved');

drop policy if exists "Coaches can reply to own reviews" on coach_review_replies;
create policy "Coaches can reply to own reviews"
on coach_review_replies for insert
with check (
  coach_user_id = auth.uid()
  and exists (
    select 1
    from coach_reviews
    join coaches on coaches.id = coach_reviews.coach_id
    where coach_reviews.id = coach_review_replies.review_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Users can report reviews" on coach_review_reports;
create policy "Users can report reviews"
on coach_review_reports for insert
with check (reporter_user_id = auth.uid());

create index if not exists premium_access_grants_user_idx on premium_access_grants(user_id, is_active);
create index if not exists premium_access_grants_coach_idx on premium_access_grants(coach_id, is_active);
create index if not exists saved_coaches_user_idx on saved_coaches(user_id, created_at desc);
create index if not exists saved_coaches_coach_idx on saved_coaches(coach_id);
create index if not exists coach_reviews_coach_status_idx on coach_reviews(coach_id, status, created_at desc);
create index if not exists coach_review_replies_review_status_idx on coach_review_replies(review_id, status);
create index if not exists coach_review_reports_status_idx on coach_review_reports(status, created_at desc);

create or replace function public.coach_has_message_access(target_coach_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from coaches
    where coaches.user_id = target_coach_user_id
      and coaches.admin_premium_access_until > now()
  )
  or exists (
    select 1
    from subscriptions
    where subscriptions.coach_user_id = target_coach_user_id
      and subscriptions.status in ('trialing', 'active', 'canceling')
      and coalesce(subscriptions.access_ends_at, subscriptions.current_period_end, subscriptions.trial_ends_at) > now()
  )
  or exists (
    select 1
    from premium_access_grants
    where coalesce(premium_access_grants.user_id, premium_access_grants.coach_user_id) = target_coach_user_id
      and premium_access_grants.is_active = true
      and premium_access_grants.starts_at <= now()
      and (premium_access_grants.ends_at is null or premium_access_grants.ends_at > now())
  );
$$;
