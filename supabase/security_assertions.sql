-- Manual security assertions for Supabase SQL Editor.
-- Run after creating at least two test users and one conversation.
-- Replace the placeholder UUIDs before running.

-- A user should only see their own notification rows through RLS:
-- set local request.jwt.claim.sub = 'USER_A_UUID';
-- select count(*) from notifications where user_id = 'USER_B_UUID';
-- Expected: 0 rows visible to USER_A.

-- A user should only see their own push subscriptions through RLS:
-- set local request.jwt.claim.sub = 'USER_A_UUID';
-- select count(*) from push_subscriptions where user_id = 'USER_B_UUID';
-- Expected: 0 rows visible to USER_A.

-- A free coach should not be able to read full messages through RLS:
-- set local request.jwt.claim.sub = 'FREE_COACH_USER_UUID';
-- select public.coach_has_message_access('FREE_COACH_USER_UUID'::uuid);
-- Expected: false.
-- select count(*) from messages where conversation_id = 'FREE_COACH_CONVERSATION_UUID';
-- Expected: 0 rows visible to the free coach.

-- A participant should see only participant records attached to their auth uid:
-- set local request.jwt.claim.sub = 'USER_A_UUID';
-- select distinct user_id from conversation_participants;
-- Expected: only USER_A_UUID.
