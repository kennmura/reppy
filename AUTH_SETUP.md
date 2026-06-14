# Reppy Auth Setup

Supabase Auth sends all registration confirmation and password recovery email. Reppy stores the
application role in `public.user_profiles`, not in auth metadata.

## Routes

Coach:

- `/coach/register`
- `/coach/login`
- `/coach/forgot-password`
- `/coach/reset-password`
- `/coach/onboarding`
- `/coach/dashboard`
- `/coach/profile/edit`
- `/coach/profile/preview`

Parent/player:

- `/account/register`
- `/account/login`
- `/account/verify-email`
- `/account/verify-phone`
- `/account/forgot-password`
- `/account/reset-password`
- `/account/onboarding`
- `/account/dashboard`
- `/account/preferences`
- `/account/settings`

Shared:

- `/auth/callback`

## Supabase Auth URL Configuration

Local Site URL:

```text
http://127.0.0.1:3002
```

Local Redirect URLs:

```text
http://127.0.0.1:3002/**
http://localhost:3002/**
```

Add the production domain with the same wildcard pattern before launch.

## Database Setup

Run SQL in this order:

1. `supabase/schema.sql`
2. `supabase/migrations/20260613_internal_messaging_push_retention.sql`
3. `supabase/migrations/20260613_auth_onboarding_profiles.sql`
4. `supabase/migrations/20260613_request_verification_realtime.sql`
5. `supabase/seed.sql`
6. `supabase/bootstrap.sql`
7. `supabase/bootstrap_first_coach.sql` after replacing the Auth user UUID placeholder

The auth onboarding migration adds:

- `user_profiles.role` and `user_profiles.account_status` checks
- `handle_new_auth_user()` trigger for first profile creation
- coach onboarding/status/completion fields
- service format/level fields
- `coach_credentials`
- `coach_private_details`
- `user_coaching_preferences`
- owner RLS policies and `coach-media` owner upload policies

The request verification migration adds:

- `account_private_details`
- `training_requests.client_request_id`
- requester/idempotency indexes
- owner RLS for private phone details
- `create_training_request_verified()` for atomic verified request creation

## First Coach Bootstrap

1. Create the first coach user in Supabase Auth.
2. Confirm the user email.
3. Copy the Auth user UUID.
4. Replace `REPLACE_WITH_AUTH_USER_UUID` in `supabase/bootstrap_first_coach.sql`.
5. Run the script.

After that, the coach signs in at `/coach/login` and can edit their profile at
`/coach/profile/edit`.
