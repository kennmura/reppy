# Supabase Setup

This guide is for the Reppy project owner. Do not commit real credentials.

## 1. Create the Supabase Project

1. Create a new Supabase project.
2. Copy the Project URL.
3. Copy the Publishable key beginning with `sb_publishable_`.
4. Copy the Secret key beginning with `sb_secret_`.
5. Store the values only in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Temporary fallback names are still supported during migration:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 2. Configure Supabase Auth

In Supabase, open Authentication -> URL Configuration.

Local Site URL:

```text
http://127.0.0.1:3002
```

Local redirect URLs:

```text
http://127.0.0.1:3002/**
http://localhost:3002/**
```

Production URLs should be added separately for the deployed domain.

Supabase Auth should handle account confirmation, password recovery, and auth links. Reppy does not use Resend directly for authentication emails.

See `AUTH_SETUP.md` for the current coach and parent/player auth route map.

## 3. Run SQL

Run these files in order:

1. `supabase/schema.sql`
2. `supabase/migrations/20260613_internal_messaging_push_retention.sql`
3. `supabase/migrations/20260613_auth_onboarding_profiles.sql`
4. `supabase/migrations/20260613_request_verification_realtime.sql`
5. `supabase/seed.sql`
6. `supabase/bootstrap.sql`
7. `supabase/bootstrap_first_coach.sql` after replacing the Auth user UUID placeholder

For an existing project that already ran the current schema, run only:

1. `supabase/migrations/20260613_internal_messaging_push_retention.sql`
2. `supabase/migrations/20260613_auth_onboarding_profiles.sql`
3. `supabase/migrations/20260613_request_verification_realtime.sql`
4. `supabase/bootstrap.sql`
5. `supabase/bootstrap_first_coach.sql` after replacing the Auth user UUID placeholder

The migration is idempotent and does not delete existing conversations, messages, coaches, applications, subscriptions, player records, or access grants.

## 4. Create the First Users

1. Create a Supabase Auth user for the owner.
2. Set `ADMIN_EMAIL` in `.env.local` to that email.
3. Create or confirm the Ken coach profile from `supabase/seed.sql`.
4. Link the Auth user to the Ken coach profile by running `supabase/bootstrap_first_coach.sql`
   after replacing `REPLACE_WITH_AUTH_USER_UUID`.

## 5. Verify

1. Start the app on `http://127.0.0.1:3002`.
2. Visit `/api/health/supabase`.
3. Confirm:

```json
{
  "configured": true,
  "reachable": true,
  "schemaReady": true,
  "authSchemaReady": true,
  "realtimeReady": true
}
```

4. Verify Realtime includes `notifications`, `conversation_participants`, `messages`, and `conversations`.
5. Test account confirmation through Supabase Auth.
6. Test one training request and one reply.
7. Test that a free coach can see locked metadata but cannot retrieve full message content.
8. Test the retention job with test data and a valid `CRON_SECRET`.
9. Test push subscriptions after completing `WEB_PUSH_SETUP.md`.

## 6. Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

ADMIN_EMAIL=your_email@example.com
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3002
FOUNDING_COACH_LIMIT=5
CRON_SECRET=

NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your_email@example.com

FREE_COACH_ALERT_EMAILS_ENABLED=false
RESEND_API_KEY=
ALERT_EMAIL_FROM=Reppy <notifications@yourdomain.com>
```
