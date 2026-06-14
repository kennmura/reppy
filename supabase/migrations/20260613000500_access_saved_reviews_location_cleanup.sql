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

update premium_access_grants
set user_id = coach_user_id
where user_id is null and coach_user_id is not null;

update premium_access_grants
set coach_id = coaches.id
from coaches
where premium_access_grants.coach_id is null
  and coaches.user_id = premium_access_grants.coach_user_id;

create index if not exists premium_access_grants_user_idx on premium_access_grants(user_id, is_active);
create index if not exists premium_access_grants_coach_idx on premium_access_grants(coach_id, is_active);

create table if not exists saved_coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  notes text,
  created_at timestamp with time zone not null default now(),
  unique (user_id, coach_id)
);

alter table saved_coaches enable row level security;

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

create index if not exists saved_coaches_user_idx on saved_coaches(user_id, created_at desc);
create index if not exists saved_coaches_coach_idx on saved_coaches(coach_id);

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

alter table coach_reviews enable row level security;
alter table coach_review_replies enable row level security;
alter table coach_review_reports enable row level security;

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
