create extension if not exists "pgcrypto";

alter table if exists public.user_profiles
  add column if not exists updated_at timestamp with time zone default now();

alter table if exists public.user_profiles
  alter column display_name set default 'Reppy user',
  alter column account_status set default 'active';

update public.user_profiles
set
  display_name = coalesce(nullif(display_name, ''), 'Reppy user'),
  account_status = coalesce(nullif(account_status, ''), 'active'),
  updated_at = coalesce(updated_at, now());

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

alter table public.coaches
  add column if not exists playing_experience text,
  add column if not exists coaching_experience text,
  add column if not exists current_affiliation text,
  add column if not exists years_experience integer,
  add column if not exists training_approach text,
  add column if not exists age_groups text,
  add column if not exists skill_levels text,
  add column if not exists positions text,
  add column if not exists training_format text,
  add column if not exists general_availability text,
  add column if not exists profile_completion integer default 0,
  add column if not exists onboarding_step integer default 1,
  add column if not exists onboarding_completed_at timestamp with time zone,
  add column if not exists submitted_at timestamp with time zone,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists review_notes text;

update public.coaches
set profile_status = case
  when is_published then 'published'
  when profile_status is null then 'draft'
  else profile_status
end;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coaches_profile_status_check'
  ) then
    alter table public.coaches
      add constraint coaches_profile_status_check
      check (profile_status in ('draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'suspended'));
  end if;
end $$;

alter table public.coach_services
  add column if not exists format text,
  add column if not exists level text,
  add column if not exists is_featured boolean default false,
  add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.coach_credentials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  title text not null,
  organization text,
  description text,
  year integer,
  sort_order integer default 0,
  is_verified boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.user_coaching_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
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

create table if not exists public.coach_private_details (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  legal_name text,
  contact_email text,
  contact_phone text,
  payout_notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists coaches_user_id_idx on public.coaches(user_id);
create index if not exists coaches_profile_status_idx on public.coaches(profile_status);
create index if not exists coach_credentials_coach_id_idx on public.coach_credentials(coach_id);

alter table public.user_profiles enable row level security;
alter table public.coach_credentials enable row level security;
alter table public.user_coaching_preferences enable row level security;
alter table public.coach_private_details enable row level security;

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

drop policy if exists "Coach owners can read own coach profile" on public.coaches;
create policy "Coach owners can read own coach profile"
on public.coaches for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Coach owners can update own coach profile" on public.coaches;
create policy "Coach owners can update own coach profile"
on public.coaches for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and is_published = false);

drop policy if exists "Coach owners can read own credentials" on public.coach_credentials;
create policy "Coach owners can read own credentials"
on public.coach_credentials for select
to authenticated
using (exists (
  select 1 from public.coaches
  where coaches.id = coach_credentials.coach_id
    and coaches.user_id = auth.uid()
));

drop policy if exists "Published coach credentials are public" on public.coach_credentials;
create policy "Published coach credentials are public"
on public.coach_credentials for select
using (exists (
  select 1 from public.coaches
  where coaches.id = coach_credentials.coach_id
    and coaches.is_published = true
));

drop policy if exists "Coach owners can manage own credentials" on public.coach_credentials;
create policy "Coach owners can manage own credentials"
on public.coach_credentials for all
to authenticated
using (exists (
  select 1 from public.coaches
  where coaches.id = coach_credentials.coach_id
    and coaches.user_id = auth.uid()
))
with check (exists (
  select 1 from public.coaches
  where coaches.id = coach_credentials.coach_id
    and coaches.user_id = auth.uid()
));

drop policy if exists "Users can read own coaching preferences" on public.user_coaching_preferences;
create policy "Users can read own coaching preferences"
on public.user_coaching_preferences for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can upsert own coaching preferences" on public.user_coaching_preferences;
create policy "Users can upsert own coaching preferences"
on public.user_coaching_preferences for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Coach owners can read own private details" on public.coach_private_details;
create policy "Coach owners can read own private details"
on public.coach_private_details for select
to authenticated
using (exists (
  select 1 from public.coaches
  where coaches.id = coach_private_details.coach_id
    and coaches.user_id = auth.uid()
));

drop policy if exists "Coach owners can manage own private details" on public.coach_private_details;
create policy "Coach owners can manage own private details"
on public.coach_private_details for all
to authenticated
using (exists (
  select 1 from public.coaches
  where coaches.id = coach_private_details.coach_id
    and coaches.user_id = auth.uid()
))
with check (exists (
  select 1 from public.coaches
  where coaches.id = coach_private_details.coach_id
    and coaches.user_id = auth.uid()
));

drop policy if exists "Coach owners can manage own media" on storage.objects;
create policy "Coach owners can manage own media"
on storage.objects for all
to authenticated
using (
  bucket_id = 'coach-media'
  and exists (
    select 1 from public.coaches
    where coaches.id::text = (storage.foldername(name))[1]
      and coaches.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'coach-media'
  and exists (
    select 1 from public.coaches
    where coaches.id::text = (storage.foldername(name))[1]
      and coaches.user_id = auth.uid()
  )
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'parent');
  safe_role := case
    when requested_role in ('coach', 'parent', 'adult_player') then requested_role
    else 'parent'
  end;

  insert into public.user_profiles (
    id,
    role,
    display_name,
    email_verified_at,
    account_status,
    created_at,
    updated_at
  )
  values (
    new.id,
    safe_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'Reppy user'),
    new.email_confirmed_at,
    'active',
    now(),
    now()
  )
  on conflict (id) do update
  set
    display_name = coalesce(nullif(excluded.display_name, ''), public.user_profiles.display_name),
    email_verified_at = coalesce(excluded.email_verified_at, public.user_profiles.email_verified_at),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
