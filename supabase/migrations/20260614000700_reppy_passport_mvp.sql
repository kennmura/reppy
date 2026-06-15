-- Reppy Passport MVP: player-centric profiles, teams, clips, feedback,
-- reflections, handoff summaries, access controls, and moderation reports.

create extension if not exists "pgcrypto";

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text unique,
  display_name text not null,
  profile_photo_url text,
  banner_image_url text,
  sport text not null default 'soccer',
  position text,
  secondary_positions text[] not null default '{}',
  graduation_year integer,
  current_team text,
  achievements text,
  strengths text,
  goals text,
  height text,
  dominant_foot text,
  dominant_hand text,
  position_group text,
  preferred_side text,
  playing_style text,
  bio text,
  city text,
  state text,
  visibility text not null default 'private',
  team_names_public boolean not null default false,
  height_public boolean not null default false,
  location_public boolean not null default false,
  is_minor boolean not null default true,
  date_of_birth date,
  private_notes text,
  status text not null default 'active',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_profiles_slug_format_check check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint player_profiles_sport_check check (sport in ('soccer', 'basketball')),
  constraint player_profiles_visibility_check check (visibility in ('public', 'private')),
  constraint player_profiles_status_check check (status in ('active', 'hidden', 'removed')),
  constraint player_profiles_graduation_year_check check (graduation_year is null or graduation_year between 2020 and 2045),
  constraint player_profiles_location_public_check check (
    (location_public = false) or (city is not null and state is not null)
  )
);

create table if not exists public.player_profile_emails (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  email_normalized text not null,
  email_type text not null,
  is_verified boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_profile_emails_lower_check check (email_normalized = lower(email_normalized)),
  constraint player_profile_emails_type_check check (email_type in ('school', 'personal', 'parent')),
  unique (player_profile_id, email_normalized)
);

create table if not exists public.player_profile_parent_links (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  parent_user_id uuid references auth.users(id) on delete cascade,
  parent_email_normalized text,
  relationship text not null default 'parent_guardian',
  status text not null default 'invited',
  invited_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_parent_links_email_lower_check check (
    parent_email_normalized is null or parent_email_normalized = lower(parent_email_normalized)
  ),
  constraint player_parent_links_relationship_check check (relationship in ('parent_guardian', 'guardian', 'caregiver')),
  constraint player_parent_links_status_check check (status in ('invited', 'active', 'revoked'))
);

create unique index if not exists player_parent_links_active_unique_idx
  on public.player_profile_parent_links(player_profile_id, parent_user_id)
  where parent_user_id is not null and status <> 'revoked';

create table if not exists public.passport_teams (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete set null,
  name text not null,
  sport text not null,
  team_type text not null default 'high_school',
  season_name text,
  age_group text,
  school_or_club text,
  city text,
  state text,
  join_code text unique not null,
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint passport_teams_sport_check check (sport in ('soccer', 'basketball')),
  constraint passport_teams_type_check check (team_type in ('high_school', 'club', 'private_training_group', 'other')),
  constraint passport_teams_status_check check (status in ('active', 'archived', 'removed')),
  constraint passport_teams_join_code_check check (join_code ~ '^[A-Z0-9]{6,12}$')
);

create table if not exists public.passport_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.passport_teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  player_profile_id uuid references public.player_profiles(id) on delete cascade,
  member_role text not null,
  staff_role text,
  status text not null default 'active',
  joined_at timestamp with time zone default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint passport_team_members_role_check check (member_role in ('head_coach', 'assistant_coach', 'support_coach', 'player', 'parent')),
  constraint passport_team_members_staff_role_check check (staff_role is null or staff_role in ('head', 'assistant', 'support')),
  constraint passport_team_members_status_check check (status in ('active', 'invited', 'left', 'removed'))
);

create unique index if not exists passport_team_members_user_role_unique_idx
  on public.passport_team_members(team_id, user_id, member_role)
  where user_id is not null and status <> 'removed';

create unique index if not exists passport_team_members_player_unique_idx
  on public.passport_team_members(team_id, player_profile_id)
  where player_profile_id is not null and status <> 'removed';

create table if not exists public.passport_roster_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.passport_teams(id) on delete cascade,
  player_profile_id uuid references public.player_profiles(id) on delete set null,
  player_name text not null,
  parent_email_normalized text,
  player_school_email_normalized text,
  player_personal_email_normalized text,
  position text,
  jersey_number text,
  graduation_year integer,
  height text,
  team_name text,
  season_name text,
  coach_notes text,
  invite_token text unique not null,
  join_code text not null,
  status text not null default 'sent',
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamp with time zone,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint passport_roster_invites_status_check check (status in ('draft', 'sent', 'accepted', 'revoked', 'expired')),
  constraint passport_roster_invites_email_lower_check check (
    (parent_email_normalized is null or parent_email_normalized = lower(parent_email_normalized))
    and (player_school_email_normalized is null or player_school_email_normalized = lower(player_school_email_normalized))
    and (player_personal_email_normalized is null or player_personal_email_normalized = lower(player_personal_email_normalized))
  ),
  constraint passport_roster_invites_contact_check check (
    parent_email_normalized is not null
    or player_school_email_normalized is not null
    or player_personal_email_normalized is not null
  ),
  constraint passport_roster_invites_graduation_year_check check (graduation_year is null or graduation_year between 2020 and 2045)
);

create table if not exists public.player_clips (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  uploaded_by_user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_by_role text not null,
  team_id uuid references public.passport_teams(id) on delete set null,
  title text not null,
  description text,
  clip_type text not null default 'training',
  storage_path text,
  public_url text,
  thumbnail_url text,
  visibility text not null default 'private',
  source text not null default 'player_upload',
  duration_seconds integer,
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_clips_uploaded_by_role_check check (uploaded_by_role in ('player', 'parent', 'team_coach', 'assistant_coach', 'private_coach', 'admin')),
  constraint player_clips_type_check check (clip_type in ('game', 'workout', 'training', 'practice', 'highlight')),
  constraint player_clips_visibility_check check (visibility in ('public', 'connected_coaches', 'private')),
  constraint player_clips_source_check check (source in ('player_upload', 'coach_upload')),
  constraint player_clips_status_check check (status in ('active', 'archived', 'reported', 'removed')),
  constraint player_clips_duration_check check (duration_seconds is null or duration_seconds between 0 and 15),
  constraint player_clips_coach_not_public_check check (source <> 'coach_upload' or visibility <> 'public')
);

create unique index if not exists player_clips_player_upload_limit_idx
  on public.player_clips(player_profile_id, source, id)
  where source = 'player_upload' and status = 'active';

create table if not exists public.player_clip_comments (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.player_clips(id) on delete cascade,
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete set null,
  body text not null,
  comment_type text not null default 'simple_comment',
  visibility text not null default 'player_parent',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_clip_comments_type_check check (comment_type in ('simple_comment', 'technical_feedback', 'tactical_feedback', 'mentality_note', 'recommended_drill')),
  constraint player_clip_comments_visibility_check check (visibility in ('current_team_only', 'player_parent', 'connected_coaches', 'shared_passport', 'internal_staff_only')),
  constraint player_clip_comments_status_check check (status in ('active', 'reported', 'hidden', 'removed'))
);

create table if not exists public.player_feedback_comments (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete set null,
  clip_id uuid references public.player_clips(id) on delete set null,
  reflection_id uuid,
  focus_area_id uuid,
  comment_type text not null default 'simple_comment',
  body text not null,
  player_strength_observed text,
  improvement_area text,
  recommended_drill text,
  visibility text not null default 'player_parent',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_feedback_comments_type_check check (
    comment_type in (
      'simple_comment',
      'technical_feedback',
      'tactical_feedback',
      'mentality_confidence_note',
      'recommended_drill',
      'strength_noticed',
      'improvement_area',
      'handoff_note'
    )
  ),
  constraint player_feedback_comments_visibility_check check (visibility in ('current_team_only', 'player_parent', 'connected_coaches', 'shared_passport', 'internal_staff_only')),
  constraint player_feedback_comments_status_check check (status in ('active', 'reported', 'hidden', 'removed'))
);

create table if not exists public.player_development_focuses (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  focus_area text not null,
  description text,
  priority integer not null default 2,
  visibility text not null default 'player_parent',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_focuses_priority_check check (priority between 1 and 3),
  constraint player_focuses_visibility_check check (visibility in ('current_team_only', 'player_parent', 'connected_coaches', 'shared_passport', 'internal_staff_only')),
  constraint player_focuses_status_check check (status in ('active', 'completed', 'archived'))
);

create unique index if not exists player_focuses_three_active_idx
  on public.player_development_focuses(player_profile_id, team_id, priority)
  where status = 'active';

create table if not exists public.player_game_reflections (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  game_date date,
  did_well text not null,
  struggled_with text not null,
  improvement_focus text not null,
  visibility text not null default 'connected_coaches',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_reflections_visibility_check check (visibility in ('player_parent', 'connected_coaches', 'shared_passport')),
  constraint player_reflections_status_check check (status in ('active', 'reported', 'hidden', 'removed'))
);

alter table public.player_feedback_comments
  drop constraint if exists player_feedback_comments_reflection_fk,
  drop constraint if exists player_feedback_comments_focus_fk,
  add constraint player_feedback_comments_reflection_fk
    foreign key (reflection_id) references public.player_game_reflections(id) on delete set null,
  add constraint player_feedback_comments_focus_fk
    foreign key (focus_area_id) references public.player_development_focuses(id) on delete set null;

create table if not exists public.player_handoff_summaries (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete set null,
  generated_by_user_id uuid not null references auth.users(id) on delete cascade,
  summary_mode text not null default 'manual',
  strengths text,
  improvement_areas text,
  recommended_focus text,
  coach_summary text,
  next_season_notes text,
  internal_staff_notes text,
  visibility text not null default 'shared_passport',
  status text not null default 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_handoffs_mode_check check (summary_mode in ('manual', 'generated_draft')),
  constraint player_handoffs_visibility_check check (visibility in ('player_parent', 'connected_coaches', 'shared_passport', 'internal_staff_only')),
  constraint player_handoffs_status_check check (status in ('draft', 'published', 'hidden', 'removed'))
);

create table if not exists public.player_profile_access (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  granted_to_user_id uuid not null references auth.users(id) on delete cascade,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  access_level text not null default 'view_development',
  scope text not null default 'full_passport',
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  revoked_at timestamp with time zone,
  constraint player_profile_access_level_check check (access_level in ('view_development', 'comment_feedback', 'team_staff', 'private_trainer')),
  constraint player_profile_access_scope_check check (scope in ('full_passport', 'team_only', 'current_season', 'specific_clip')),
  constraint player_profile_access_status_check check (status in ('active', 'revoked'))
);

create unique index if not exists player_profile_access_active_unique_idx
  on public.player_profile_access(player_profile_id, granted_to_user_id, access_level, scope)
  where status = 'active';

create table if not exists public.player_development_timeline (
  id uuid primary key default gen_random_uuid(),
  player_profile_id uuid not null references public.player_profiles(id) on delete cascade,
  team_id uuid references public.passport_teams(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  body text,
  source_table text,
  source_id uuid,
  visibility text not null default 'connected_coaches',
  status text not null default 'active',
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint player_timeline_visibility_check check (visibility in ('public', 'player_parent', 'connected_coaches', 'shared_passport', 'internal_staff_only')),
  constraint player_timeline_status_check check (status in ('active', 'hidden', 'removed'))
);

create table if not exists public.passport_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  player_profile_id uuid references public.player_profiles(id) on delete cascade,
  content_type text not null,
  content_id uuid,
  reason text not null,
  details text,
  status text not null default 'open',
  admin_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint passport_reports_type_check check (content_type in ('player_profile', 'clip', 'clip_comment', 'feedback', 'handoff_summary', 'reflection', 'focus_area')),
  constraint passport_reports_reason_check check (reason in ('inappropriate_content', 'harassment', 'bullying', 'private_information', 'false_information', 'unsafe_adult_minor_communication', 'spam', 'other')),
  constraint passport_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists player_profiles_user_idx on public.player_profiles(user_id);
create index if not exists player_profiles_public_idx on public.player_profiles(slug, visibility, status);
create index if not exists player_profile_emails_email_idx on public.player_profile_emails(email_normalized);
create index if not exists player_parent_links_parent_idx on public.player_profile_parent_links(parent_user_id, status);
create index if not exists passport_teams_coach_idx on public.passport_teams(coach_user_id, status);
create index if not exists passport_team_members_team_idx on public.passport_team_members(team_id, status);
create index if not exists passport_team_members_player_idx on public.passport_team_members(player_profile_id, status);
create index if not exists passport_roster_invites_team_idx on public.passport_roster_invites(team_id, status, created_at desc);
create index if not exists passport_roster_invites_join_code_idx on public.passport_roster_invites(join_code, status);
create index if not exists passport_roster_invites_email_idx on public.passport_roster_invites(parent_email_normalized, player_school_email_normalized, player_personal_email_normalized);
create index if not exists player_clips_player_idx on public.player_clips(player_profile_id, status, created_at desc);
create index if not exists player_clip_comments_clip_idx on public.player_clip_comments(clip_id, status, created_at desc);
create index if not exists player_feedback_player_idx on public.player_feedback_comments(player_profile_id, status, created_at desc);
create index if not exists player_focuses_player_team_idx on public.player_development_focuses(player_profile_id, team_id, status);
create index if not exists player_reflections_player_idx on public.player_game_reflections(player_profile_id, created_at desc);
create index if not exists player_handoffs_player_idx on public.player_handoff_summaries(player_profile_id, status, created_at desc);
create index if not exists player_access_player_idx on public.player_profile_access(player_profile_id, status);
create index if not exists player_timeline_player_idx on public.player_development_timeline(player_profile_id, occurred_at desc);
create index if not exists passport_reports_status_idx on public.passport_content_reports(status, created_at desc);

drop trigger if exists set_player_profiles_updated_at on public.player_profiles;
create trigger set_player_profiles_updated_at before update on public.player_profiles
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_profile_emails_updated_at on public.player_profile_emails;
create trigger set_player_profile_emails_updated_at before update on public.player_profile_emails
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_profile_parent_links_updated_at on public.player_profile_parent_links;
create trigger set_player_profile_parent_links_updated_at before update on public.player_profile_parent_links
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_passport_teams_updated_at on public.passport_teams;
create trigger set_passport_teams_updated_at before update on public.passport_teams
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_passport_team_members_updated_at on public.passport_team_members;
create trigger set_passport_team_members_updated_at before update on public.passport_team_members
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_passport_roster_invites_updated_at on public.passport_roster_invites;
create trigger set_passport_roster_invites_updated_at before update on public.passport_roster_invites
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_clips_updated_at on public.player_clips;
create trigger set_player_clips_updated_at before update on public.player_clips
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_clip_comments_updated_at on public.player_clip_comments;
create trigger set_player_clip_comments_updated_at before update on public.player_clip_comments
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_feedback_comments_updated_at on public.player_feedback_comments;
create trigger set_player_feedback_comments_updated_at before update on public.player_feedback_comments
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_development_focuses_updated_at on public.player_development_focuses;
create trigger set_player_development_focuses_updated_at before update on public.player_development_focuses
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_game_reflections_updated_at on public.player_game_reflections;
create trigger set_player_game_reflections_updated_at before update on public.player_game_reflections
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_player_handoff_summaries_updated_at on public.player_handoff_summaries;
create trigger set_player_handoff_summaries_updated_at before update on public.player_handoff_summaries
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_passport_content_reports_updated_at on public.passport_content_reports;
create trigger set_passport_content_reports_updated_at before update on public.passport_content_reports
for each row execute function public.set_updated_at_timestamp();

create or replace function public.passport_player_is_owner(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_profiles
    where id = target_player_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.passport_player_has_parent(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_profile_parent_links
    where player_profile_id = target_player_id
      and parent_user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.passport_user_is_team_staff(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.passport_team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and member_role in ('head_coach', 'assistant_coach', 'support_coach')
      and status = 'active'
  )
  or exists (
    select 1
    from public.passport_teams
    where id = target_team_id
      and coach_user_id = auth.uid()
      and status <> 'removed'
  );
$$;

create or replace function public.passport_player_has_team_staff_access(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.passport_team_members player_member
    join public.passport_team_members staff_member
      on staff_member.team_id = player_member.team_id
    where player_member.player_profile_id = target_player_id
      and player_member.member_role = 'player'
      and player_member.status = 'active'
      and staff_member.user_id = auth.uid()
      and staff_member.member_role in ('head_coach', 'assistant_coach', 'support_coach')
      and staff_member.status = 'active'
  )
  or exists (
    select 1
    from public.passport_team_members player_member
    join public.passport_teams team on team.id = player_member.team_id
    where player_member.player_profile_id = target_player_id
      and player_member.member_role = 'player'
      and player_member.status = 'active'
      and team.coach_user_id = auth.uid()
      and team.status <> 'removed'
  );
$$;

create or replace function public.passport_player_can_read_private(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.passport_player_is_owner(target_player_id)
    or public.passport_player_has_parent(target_player_id)
    or public.passport_player_has_team_staff_access(target_player_id)
    or exists (
      select 1
      from public.player_profile_access
      where player_profile_id = target_player_id
        and granted_to_user_id = auth.uid()
        and status = 'active'
    );
$$;

create or replace function public.passport_player_can_manage(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or public.passport_player_is_owner(target_player_id)
    or public.passport_player_has_parent(target_player_id);
$$;

create or replace function public.passport_player_can_coach_write(target_player_id uuid, target_team_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      target_team_id is not null
      and public.passport_user_is_team_staff(target_team_id)
      and exists (
        select 1
        from public.passport_team_members
        where team_id = target_team_id
          and player_profile_id = target_player_id
          and member_role = 'player'
          and status = 'active'
      )
    )
    or exists (
      select 1
      from public.player_profile_access
      where player_profile_id = target_player_id
        and granted_to_user_id = auth.uid()
        and access_level in ('comment_feedback', 'team_staff', 'private_trainer')
        and status = 'active'
    );
$$;

revoke all on function public.passport_player_is_owner(uuid) from public;
revoke all on function public.passport_player_has_parent(uuid) from public;
revoke all on function public.passport_user_is_team_staff(uuid) from public;
revoke all on function public.passport_player_has_team_staff_access(uuid) from public;
revoke all on function public.passport_player_can_read_private(uuid) from public;
revoke all on function public.passport_player_can_manage(uuid) from public;
revoke all on function public.passport_player_can_coach_write(uuid, uuid) from public;

grant execute on function public.passport_player_is_owner(uuid) to authenticated;
grant execute on function public.passport_player_has_parent(uuid) to authenticated;
grant execute on function public.passport_user_is_team_staff(uuid) to authenticated;
grant execute on function public.passport_player_has_team_staff_access(uuid) to authenticated;
grant execute on function public.passport_player_can_read_private(uuid) to authenticated;
grant execute on function public.passport_player_can_manage(uuid) to authenticated;
grant execute on function public.passport_player_can_coach_write(uuid, uuid) to authenticated;

alter table public.player_profiles enable row level security;
alter table public.player_profile_emails enable row level security;
alter table public.player_profile_parent_links enable row level security;
alter table public.passport_teams enable row level security;
alter table public.passport_team_members enable row level security;
alter table public.passport_roster_invites enable row level security;
alter table public.player_clips enable row level security;
alter table public.player_clip_comments enable row level security;
alter table public.player_feedback_comments enable row level security;
alter table public.player_development_focuses enable row level security;
alter table public.player_game_reflections enable row level security;
alter table public.player_handoff_summaries enable row level security;
alter table public.player_profile_access enable row level security;
alter table public.player_development_timeline enable row level security;
alter table public.passport_content_reports enable row level security;

drop policy if exists "Public can read public player profiles" on public.player_profiles;
create policy "Public can read public player profiles"
on public.player_profiles for select
using (visibility = 'public' and status = 'active');

drop policy if exists "Private passport readers can read player profiles" on public.player_profiles;
create policy "Private passport readers can read player profiles"
on public.player_profiles for select
to authenticated
using (public.passport_player_can_read_private(id));

drop policy if exists "Users can create their own player profiles" on public.player_profiles;
create policy "Users can create their own player profiles"
on public.player_profiles for insert
to authenticated
with check (user_id = auth.uid() or created_by_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Owners and linked parents can update player profiles" on public.player_profiles;
create policy "Owners and linked parents can update player profiles"
on public.player_profiles for update
to authenticated
using (public.passport_player_can_manage(id))
with check (public.passport_player_can_manage(id));

drop policy if exists "Passport admins manage player profiles" on public.player_profiles;
create policy "Passport admins manage player profiles"
on public.player_profiles for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Private readers can read player emails" on public.player_profile_emails;
create policy "Private readers can read player emails"
on public.player_profile_emails for select
to authenticated
using (public.passport_player_can_manage(player_profile_id) or public.current_user_is_admin());

drop policy if exists "Managers can manage player emails" on public.player_profile_emails;
create policy "Managers can manage player emails"
on public.player_profile_emails for all
to authenticated
using (public.passport_player_can_manage(player_profile_id))
with check (public.passport_player_can_manage(player_profile_id));

drop policy if exists "Parents and owners can read parent links" on public.player_profile_parent_links;
create policy "Parents and owners can read parent links"
on public.player_profile_parent_links for select
to authenticated
using (
  public.passport_player_can_manage(player_profile_id)
  or parent_user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Managers can manage parent links" on public.player_profile_parent_links;
create policy "Managers can manage parent links"
on public.player_profile_parent_links for all
to authenticated
using (public.passport_player_can_manage(player_profile_id))
with check (public.passport_player_can_manage(player_profile_id));

drop policy if exists "Team members can read teams" on public.passport_teams;
create policy "Team members can read teams"
on public.passport_teams for select
to authenticated
using (
  coach_user_id = auth.uid()
  or public.passport_user_is_team_staff(id)
  or exists (
    select 1 from public.passport_team_members
    where passport_team_members.team_id = passport_teams.id
      and passport_team_members.user_id = auth.uid()
      and passport_team_members.status = 'active'
  )
  or public.current_user_is_admin()
);

drop policy if exists "Coaches can create passport teams" on public.passport_teams;
create policy "Coaches can create passport teams"
on public.passport_teams for insert
to authenticated
with check (coach_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Team owners can update teams" on public.passport_teams;
create policy "Team owners can update teams"
on public.passport_teams for update
to authenticated
using (coach_user_id = auth.uid() or public.current_user_is_admin())
with check (coach_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Team members can read team members" on public.passport_team_members;
create policy "Team members can read team members"
on public.passport_team_members for select
to authenticated
using (
  public.passport_user_is_team_staff(team_id)
  or user_id = auth.uid()
  or (player_profile_id is not null and public.passport_player_can_read_private(player_profile_id))
  or public.current_user_is_admin()
);

drop policy if exists "Team staff can manage team members" on public.passport_team_members;
create policy "Team staff can manage team members"
on public.passport_team_members for all
to authenticated
using (public.passport_user_is_team_staff(team_id) or public.current_user_is_admin())
with check (public.passport_user_is_team_staff(team_id) or public.current_user_is_admin());

drop policy if exists "Team staff can read roster invites" on public.passport_roster_invites;
create policy "Team staff can read roster invites"
on public.passport_roster_invites for select
to authenticated
using (
  public.passport_user_is_team_staff(team_id)
  or accepted_by_user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Team staff can manage roster invites" on public.passport_roster_invites;
create policy "Team staff can manage roster invites"
on public.passport_roster_invites for all
to authenticated
using (public.passport_user_is_team_staff(team_id) or public.current_user_is_admin())
with check (public.passport_user_is_team_staff(team_id) or public.current_user_is_admin());

drop policy if exists "Public can read public player clips" on public.player_clips;
create policy "Public can read public player clips"
on public.player_clips for select
using (
  status = 'active'
  and visibility = 'public'
  and source = 'player_upload'
  and exists (
    select 1 from public.player_profiles
    where player_profiles.id = player_clips.player_profile_id
      and player_profiles.visibility = 'public'
      and player_profiles.status = 'active'
  )
);

drop policy if exists "Private readers can read player clips" on public.player_clips;
create policy "Private readers can read player clips"
on public.player_clips for select
to authenticated
using (public.passport_player_can_read_private(player_profile_id));

drop policy if exists "Owners and coaches can insert player clips" on public.player_clips;
create policy "Owners and coaches can insert player clips"
on public.player_clips for insert
to authenticated
with check (
  (source = 'player_upload' and uploaded_by_user_id = auth.uid() and public.passport_player_can_manage(player_profile_id))
  or (source = 'coach_upload' and uploaded_by_user_id = auth.uid() and public.passport_player_can_coach_write(player_profile_id, team_id))
  or public.current_user_is_admin()
);

drop policy if exists "Owners and admins can update player clips" on public.player_clips;
create policy "Owners and admins can update player clips"
on public.player_clips for update
to authenticated
using (
  public.current_user_is_admin()
  or (source = 'player_upload' and public.passport_player_can_manage(player_profile_id))
  or (source = 'coach_upload' and uploaded_by_user_id = auth.uid() and public.passport_player_can_coach_write(player_profile_id, team_id))
)
with check (
  public.current_user_is_admin()
  or (source = 'player_upload' and public.passport_player_can_manage(player_profile_id))
  or (source = 'coach_upload' and uploaded_by_user_id = auth.uid() and public.passport_player_can_coach_write(player_profile_id, team_id))
);

drop policy if exists "Private readers can read clip comments" on public.player_clip_comments;
create policy "Private readers can read clip comments"
on public.player_clip_comments for select
to authenticated
using (
  public.passport_player_can_read_private(player_profile_id)
  and status <> 'removed'
  and (visibility <> 'internal_staff_only' or public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin())
);

drop policy if exists "Connected coaches can write clip comments" on public.player_clip_comments;
create policy "Connected coaches can write clip comments"
on public.player_clip_comments for insert
to authenticated
with check (author_user_id = auth.uid() and public.passport_player_can_coach_write(player_profile_id, team_id));

drop policy if exists "Private readers can read feedback" on public.player_feedback_comments;
create policy "Private readers can read feedback"
on public.player_feedback_comments for select
to authenticated
using (
  public.passport_player_can_read_private(player_profile_id)
  and status <> 'removed'
  and (visibility <> 'internal_staff_only' or public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin())
);

drop policy if exists "Connected coaches can write feedback" on public.player_feedback_comments;
create policy "Connected coaches can write feedback"
on public.player_feedback_comments for insert
to authenticated
with check (author_user_id = auth.uid() and public.passport_player_can_coach_write(player_profile_id, team_id));

drop policy if exists "Private readers can read focuses" on public.player_development_focuses;
create policy "Private readers can read focuses"
on public.player_development_focuses for select
to authenticated
using (public.passport_player_can_read_private(player_profile_id) and status <> 'archived');

drop policy if exists "Connected coaches can manage focuses" on public.player_development_focuses;
create policy "Connected coaches can manage focuses"
on public.player_development_focuses for all
to authenticated
using (public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin())
with check (public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin());

drop policy if exists "Private readers can read reflections" on public.player_game_reflections;
create policy "Private readers can read reflections"
on public.player_game_reflections for select
to authenticated
using (public.passport_player_can_read_private(player_profile_id) and status <> 'removed');

drop policy if exists "Players and parents can create reflections" on public.player_game_reflections;
create policy "Players and parents can create reflections"
on public.player_game_reflections for insert
to authenticated
with check (created_by_user_id = auth.uid() and public.passport_player_can_manage(player_profile_id));

drop policy if exists "Players and parents can update reflections" on public.player_game_reflections;
create policy "Players and parents can update reflections"
on public.player_game_reflections for update
to authenticated
using (public.passport_player_can_manage(player_profile_id) or public.current_user_is_admin())
with check (public.passport_player_can_manage(player_profile_id) or public.current_user_is_admin());

drop policy if exists "Private readers can read handoff summaries" on public.player_handoff_summaries;
create policy "Private readers can read handoff summaries"
on public.player_handoff_summaries for select
to authenticated
using (
  public.passport_player_can_read_private(player_profile_id)
  and status <> 'removed'
  and (visibility <> 'internal_staff_only' or public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin())
);

drop policy if exists "Connected coaches can manage handoff summaries" on public.player_handoff_summaries;
create policy "Connected coaches can manage handoff summaries"
on public.player_handoff_summaries for all
to authenticated
using (public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin())
with check (public.passport_player_can_coach_write(player_profile_id, team_id) or public.current_user_is_admin());

drop policy if exists "Private readers can read profile access grants" on public.player_profile_access;
create policy "Private readers can read profile access grants"
on public.player_profile_access for select
to authenticated
using (public.passport_player_can_manage(player_profile_id) or granted_to_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Managers can manage profile access grants" on public.player_profile_access;
create policy "Managers can manage profile access grants"
on public.player_profile_access for all
to authenticated
using (public.passport_player_can_manage(player_profile_id) or public.current_user_is_admin())
with check (public.passport_player_can_manage(player_profile_id) or public.current_user_is_admin());

drop policy if exists "Public can read public timeline" on public.player_development_timeline;
create policy "Public can read public timeline"
on public.player_development_timeline for select
using (
  visibility = 'public'
  and status = 'active'
  and exists (
    select 1 from public.player_profiles
    where player_profiles.id = player_development_timeline.player_profile_id
      and player_profiles.visibility = 'public'
      and player_profiles.status = 'active'
  )
);

drop policy if exists "Private readers can read timeline" on public.player_development_timeline;
create policy "Private readers can read timeline"
on public.player_development_timeline for select
to authenticated
using (public.passport_player_can_read_private(player_profile_id) and status = 'active');

drop policy if exists "Authenticated users can create content reports" on public.passport_content_reports;
create policy "Authenticated users can create content reports"
on public.passport_content_reports for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists "Reporters can read own reports" on public.passport_content_reports;
create policy "Reporters can read own reports"
on public.passport_content_reports for select
to authenticated
using (reporter_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Admins can manage content reports" on public.passport_content_reports;
create policy "Admins can manage content reports"
on public.passport_content_reports for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-clips',
  'player-clips',
  false,
  104857600,
  array['video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own player clip objects" on storage.objects;
create policy "Users can read own player clip objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'player-clips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own player clip objects" on storage.objects;
create policy "Users can upload own player clip objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'player-clips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own player clip objects" on storage.objects;
create policy "Users can update own player clip objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'player-clips'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'player-clips'
  and (storage.foldername(name))[1] = auth.uid()::text
);
