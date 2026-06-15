create table if not exists public.coach_review_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  invited_email_normalized text not null,
  invite_token text unique not null,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  invite_note text,
  status text not null default 'sent',
  expires_at timestamp with time zone,
  completed_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coach_review_invites_email_lower_check
    check (invited_email_normalized = lower(invited_email_normalized)),
  constraint coach_review_invites_status_check
    check (status in ('sent', 'opened', 'completed', 'expired', 'revoked'))
);

alter table public.coach_reviews
  add column if not exists training_request_id uuid references public.training_requests(id) on delete set null,
  add column if not exists training_session_id uuid references public.training_sessions(id) on delete set null,
  add column if not exists review_invite_id uuid references public.coach_review_invites(id) on delete set null,
  add column if not exists review_type text not null default 'invited_client',
  add column if not exists overall_rating integer,
  add column if not exists communication_rating integer,
  add column if not exists reliability_rating integer,
  add column if not exists training_quality_rating integer,
  add column if not exists review_title text,
  add column if not exists review_body text,
  add column if not exists reviewer_relationship text not null default 'parent_guardian',
  add column if not exists player_age_band text,
  add column if not exists training_type text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists coach_reply text,
  add column if not exists coach_reply_at timestamp with time zone,
  add column if not exists reported_at timestamp with time zone,
  add column if not exists report_reason text,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamp with time zone;

update public.coach_reviews
set
  status = case status
    when 'approved' then 'published'
    when 'rejected' then 'removed'
    else status
  end,
  overall_rating = coalesce(overall_rating, rating),
  review_title = coalesce(review_title, headline),
  review_body = coalesce(review_body, body, ''),
  published_at = case when status = 'approved' and published_at is null then now() else published_at end,
  updated_at = now()
where
  status in ('approved', 'rejected')
  or overall_rating is null
  or review_title is null and headline is not null
  or review_body is null;

alter table public.coach_reviews
  alter column overall_rating set not null,
  alter column review_body set not null,
  alter column tags set default '{}',
  alter column tags set not null;

alter table public.coach_reviews
  drop constraint if exists coach_reviews_status_check,
  drop constraint if exists coach_reviews_rating_check,
  drop constraint if exists coach_reviews_review_type_check,
  drop constraint if exists coach_reviews_overall_rating_check,
  drop constraint if exists coach_reviews_communication_rating_check,
  drop constraint if exists coach_reviews_reliability_rating_check,
  drop constraint if exists coach_reviews_training_quality_rating_check,
  drop constraint if exists coach_reviews_reviewer_relationship_check,
  drop constraint if exists coach_reviews_player_age_band_check;

alter table public.coach_reviews
  add constraint coach_reviews_status_check
    check (status in ('pending', 'published', 'hidden', 'reported', 'removed')),
  add constraint coach_reviews_review_type_check
    check (review_type in ('invited_client', 'verified_session')),
  add constraint coach_reviews_overall_rating_check
    check (overall_rating between 1 and 5),
  add constraint coach_reviews_communication_rating_check
    check (communication_rating is null or communication_rating between 1 and 5),
  add constraint coach_reviews_reliability_rating_check
    check (reliability_rating is null or reliability_rating between 1 and 5),
  add constraint coach_reviews_training_quality_rating_check
    check (training_quality_rating is null or training_quality_rating between 1 and 5),
  add constraint coach_reviews_reviewer_relationship_check
    check (reviewer_relationship in ('parent_guardian', 'player', 'adult_player', 'former_player')),
  add constraint coach_reviews_player_age_band_check
    check (player_age_band is null or player_age_band in ('U8', 'U10', 'U12', 'U14', 'high_school', 'college', 'adult'));

do $$
begin
  if not exists (
    select 1
    from public.coach_reviews
    where reviewer_user_id is null
  ) then
    alter table public.coach_reviews alter column reviewer_user_id set not null;
  end if;
end $$;

create unique index if not exists coach_reviews_one_active_per_reviewer_idx
  on public.coach_reviews(coach_id, reviewer_user_id)
  where status <> 'removed';

create index if not exists coach_reviews_coach_status_created_idx
  on public.coach_reviews(coach_id, status, created_at desc);
create index if not exists coach_reviews_reviewer_user_idx
  on public.coach_reviews(reviewer_user_id);
create index if not exists coach_reviews_training_request_idx
  on public.coach_reviews(training_request_id)
  where training_request_id is not null;
create index if not exists coach_reviews_training_session_idx
  on public.coach_reviews(training_session_id)
  where training_session_id is not null;
create index if not exists coach_reviews_review_invite_idx
  on public.coach_reviews(review_invite_id)
  where review_invite_id is not null;

create index if not exists coach_review_invites_coach_status_idx
  on public.coach_review_invites(coach_id, status, created_at desc);
create index if not exists coach_review_invites_email_idx
  on public.coach_review_invites(invited_email_normalized, coach_id, created_at desc);
create index if not exists coach_review_invites_token_idx
  on public.coach_review_invites(invite_token);
create index if not exists coach_review_invites_invited_by_idx
  on public.coach_review_invites(invited_by_user_id, created_at desc);

drop trigger if exists set_coach_review_invites_updated_at on public.coach_review_invites;
create trigger set_coach_review_invites_updated_at
before update on public.coach_review_invites
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists set_coach_reviews_updated_at on public.coach_reviews;
create trigger set_coach_reviews_updated_at
before update on public.coach_reviews
for each row
execute function public.set_updated_at_timestamp();

alter table public.coach_review_invites enable row level security;
alter table public.coach_reviews enable row level security;

drop policy if exists "Published reviews are public" on public.coach_reviews;
create policy "Published reviews are public"
on public.coach_reviews for select
using (status = 'published');

drop policy if exists "Reviewers can read own reviews" on public.coach_reviews;
create policy "Reviewers can read own reviews"
on public.coach_reviews for select
using (reviewer_user_id = auth.uid());

drop policy if exists "Coaches can read own profile reviews" on public.coach_reviews;
create policy "Coaches can read own profile reviews"
on public.coach_reviews for select
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.coaches
    where coaches.id = coach_reviews.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Reviewers can insert own non self reviews" on public.coach_reviews;
create policy "Reviewers can insert own non self reviews"
on public.coach_reviews for insert
with check (
  reviewer_user_id = auth.uid()
  and not exists (
    select 1
    from public.coaches
    where coaches.id = coach_reviews.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Reviewers can update own pending reviews" on public.coach_reviews;
create policy "Reviewers can update own pending reviews"
on public.coach_reviews for update
using (reviewer_user_id = auth.uid() and status = 'pending')
with check (reviewer_user_id = auth.uid() and status = 'pending');

drop policy if exists "Coaches can reply or report own published reviews" on public.coach_reviews;

drop policy if exists "Admins can moderate reviews" on public.coach_reviews;
create policy "Admins can moderate reviews"
on public.coach_reviews for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Coaches can read own review invites" on public.coach_review_invites;
create policy "Coaches can read own review invites"
on public.coach_review_invites for select
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.coaches
    where coaches.id = coach_review_invites.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Coaches can create own review invites" on public.coach_review_invites;
create policy "Coaches can create own review invites"
on public.coach_review_invites for insert
with check (
  invited_by_user_id = auth.uid()
  and exists (
    select 1
    from public.coaches
    where coaches.id = coach_review_invites.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Coaches can update own review invites" on public.coach_review_invites;
create policy "Coaches can update own review invites"
on public.coach_review_invites for update
using (
  exists (
    select 1
    from public.coaches
    where coaches.id = coach_review_invites.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.coaches
    where coaches.id = coach_review_invites.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Admins can manage review invites" on public.coach_review_invites;
create policy "Admins can manage review invites"
on public.coach_review_invites for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
