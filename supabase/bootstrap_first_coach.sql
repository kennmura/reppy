-- Run after creating the first coach Auth user and applying migrations.
-- Replace the placeholders before running in Supabase SQL Editor.

-- 1. Make the Auth user a coach in Reppy.
update public.user_profiles
set
  role = 'coach',
  account_status = 'active',
  display_name = coalesce(nullif(display_name, ''), 'Kenshin Murakawa'),
  updated_at = now()
where id = 'REPLACE_WITH_AUTH_USER_UUID';

-- 2. Link the public Ken coach profile to that Auth user and publish it.
update public.coaches
set
  user_id = 'REPLACE_WITH_AUTH_USER_UUID',
  profile_status = 'published',
  is_published = true,
  accepting_requests = true,
  reviewed_at = now(),
  updated_at = now()
where slug = 'ken-murakawa';

-- 3. Confirm the linked row.
select id, user_id, slug, full_name, profile_status, is_published
from public.coaches
where slug = 'ken-murakawa';
