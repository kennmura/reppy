-- Baseline schema for a fresh Supabase CLI reset.
-- The project originally relied on running supabase/schema.sql manually before
-- migrations. This file makes the migration folder self-contained without
-- dropping or rewriting existing data in already-provisioned databases.

create extension if not exists "pgcrypto";

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text unique not null,
  full_name text not null,
  email text,
  phone text,
  sport text,
  category text,
  headline text,
  bio text,
  location text,
  public_location text,
  city text,
  state text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  timezone text default 'America/New_York',
  service_area text,
  service_radius_miles integer not null default 30,
  pricing_text text default 'Pricing available upon request.',
  profile_photo_url text,
  banner_image_url text,
  instagram_url text,
  video_url text,
  booking_url text,
  is_published boolean default false,
  is_featured boolean default false,
  accepting_requests boolean default true,
  profile_status text default 'draft',
  founding_price_locked boolean default false,
  contact_scan_status text default 'clear',
  admin_premium_access_until timestamp with time zone,
  referral_code text unique,
  subscription_status text default 'manual',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.coach_services (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
  title text not null,
  description text,
  duration text,
  price text,
  format text,
  level text,
  is_featured boolean default false,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.coach_audiences (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.coach_testimonials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
  quote text not null,
  author text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.coach_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete cascade,
  availability_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  note text,
  location text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coach_availability_blocks_time_check check (end_time > start_time)
);

create table if not exists public.coach_media (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
  media_url text not null,
  media_type text default 'image',
  caption text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.user_profiles (
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

create table if not exists public.account_private_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text,
  phone_verified_at timestamp with time zone,
  player_name text,
  parent_guardian_name text,
  player_date_of_birth date,
  current_club text,
  preferred_location text,
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

create table if not exists public.user_coaching_preferences (
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

create table if not exists public.subscriptions (
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

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade,
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

create table if not exists public.conversation_private_details (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  requester_display_name text,
  requester_email text,
  requester_phone text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  service_id uuid references public.coach_services(id) on delete set null,
  service_title text,
  service_description text,
  selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  requested_date date,
  requested_start_time time,
  requested_end_time time,
  timezone text default 'America/New_York',
  player_age_at_request integer,
  exact_location text,
  preferred_days_times text,
  current_level text,
  current_team text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null,
  body text not null,
  created_at timestamp with time zone default now(),
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
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

create table if not exists public.training_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete set null,
  coach_slug text,
  conversation_id uuid references public.conversations(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  guardian_user_id uuid references auth.users(id) on delete set null,
  client_request_id uuid,
  service_id uuid references public.coach_services(id) on delete set null,
  service_title text,
  service_description text,
  selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  requested_date date,
  requested_start_time time,
  requested_end_time time,
  timezone text default 'America/New_York',
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
  status text default 'pending',
  is_minor boolean default false,
  guardian_required boolean default false,
  guardian_name text,
  guardian_confirmed_at timestamp with time zone,
  parent_follow_up_sent_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.coach_applications (
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

create table if not exists public.contact_share_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  shared_by_user_id uuid references auth.users(id) on delete set null,
  shared_fields text[] not null default '{}',
  shared_values jsonb not null default '{}'::jsonb,
  consented_at timestamp with time zone default now(),
  revoked_at timestamp with time zone
);

create table if not exists public.player_records (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete cascade,
  source_conversation_id uuid references public.conversations(id) on delete set null,
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

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  reported_by_user_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text,
  details text,
  status text default 'new',
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_coach_user_id uuid references auth.users(id) on delete cascade,
  referred_coach_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text default 'pending',
  qualified_at timestamp with time zone,
  rewarded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.premium_access_grants (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  grant_type text not null,
  granted_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  starts_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone,
  referral_id uuid references public.referrals(id) on delete set null,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.banned_identifiers (
  id uuid primary key default gen_random_uuid(),
  identifier_type text not null,
  identifier_hash text not null,
  banned_user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_conversation_id uuid references public.conversations(id) on delete cascade,
  action_url text,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.push_subscriptions (
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

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  free_coach_email_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text,
  created_at timestamp with time zone default now()
);

insert into storage.buckets (id, name, public)
values ('coach-media', 'coach-media', true)
on conflict (id) do update set public = excluded.public;

create index if not exists coaches_slug_idx on public.coaches(slug);
create index if not exists coaches_user_id_idx on public.coaches(user_id);
create index if not exists coaches_zip_code_idx on public.coaches(zip_code);
create index if not exists coaches_coordinates_idx on public.coaches(latitude, longitude)
  where latitude is not null and longitude is not null;
create index if not exists coach_services_coach_id_idx on public.coach_services(coach_id);
create index if not exists coach_audiences_coach_id_idx on public.coach_audiences(coach_id);
create index if not exists coach_testimonials_coach_id_idx on public.coach_testimonials(coach_id);
create index if not exists coach_media_coach_id_idx on public.coach_media(coach_id);
create index if not exists coach_availability_blocks_coach_date_idx
  on public.coach_availability_blocks(coach_id, availability_date, start_time);
create index if not exists conversations_coach_id_idx on public.conversations(coach_id);
create index if not exists conversations_requester_idx on public.conversations(requester_user_id);
create index if not exists conversation_participants_user_idx
  on public.conversation_participants(user_id, unread_count);
create index if not exists conversation_participants_conversation_idx
  on public.conversation_participants(conversation_id);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);
create index if not exists training_requests_requester_created_idx
  on public.training_requests(requester_user_id, created_at desc);
create index if not exists training_requests_coach_created_idx
  on public.training_requests(coach_id, created_at desc);
create index if not exists training_requests_status_idx on public.training_requests(status);
