create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'parent',
  display_name text,
  email_verified_at timestamp with time zone,
  phone_verified_at timestamp with time zone,
  account_status text default 'active',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.user_profiles
  add column if not exists phone_verified_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_role_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_role_check
      check (role in ('coach', 'parent', 'adult_player', 'admin'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_account_status_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_account_status_check
      check (account_status in ('active', 'pending', 'suspended', 'banned', 'deleted'));
  end if;
end $$;

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

create index if not exists account_private_details_phone_idx
  on public.account_private_details(phone_e164)
  where phone_e164 is not null;

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

create index if not exists training_requests_requester_created_idx
  on public.training_requests(requester_user_id, created_at desc);

alter table public.account_private_details enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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
