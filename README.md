# Reppy

Reppy is a Next.js App Router application for local sports coaching discovery, training requests, coach profiles, and a platform-owned Message Center.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS
- Supabase Postgres, Auth, Storage, and Realtime
- Browser web push with VAPID

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in placeholders only in `.env.local`:

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

FOUNDING_COACH_PLAN_CODE=founding_5
PREMIUM_COACH_PLAN_CODE=premium_15
REPPY_DISABLE_PHONE_VERIFICATION=true
```

4. Follow `SUPABASE_SETUP.md`.
5. Follow `WEB_PUSH_SETUP.md` if testing browser push.
6. Start the app:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3002
```

For local Supabase Auth, set the Supabase Site URL to the same app URL, usually
`http://127.0.0.1:3002`. Add both local callback URLs in Authentication -> URL
Configuration:

```text
http://127.0.0.1:3002/auth/callback
http://localhost:3002/auth/callback
```

Player/parent registration requires public Supabase config plus a server-only
service role or secret key. Do not expose `SUPABASE_SECRET_KEY` or
`SUPABASE_SERVICE_ROLE_KEY` to client-side code.

For local testing and the current MVP flow, `REPPY_DISABLE_PHONE_VERIFICATION=true`
temporarily bypasses phone verification while keeping the verification pages,
actions, and database fields in place. Remove it or set it to `false` when
verified phone numbers should be required again.

Player/parent profiles store player name separately from parent/guardian name.
The player name becomes `user_profiles.display_name`; private DOB lives in
`account_private_details` and is used to calculate player age at request time.
Request details come from `user_coaching_preferences` so users do not retype
club/team, goals, and preferred times on every coach request.

## Messaging Model

- Training requests and replies stay inside Reppy.
- Supabase stores conversations and messages.
- In-app notifications and unread badges are the primary alert system.
- Supabase Realtime updates notification counts.
- Browser push is available to opted-in users.
- Normal conversation activity is not emailed.
- The only custom platform email is one safe locked-request alert for a free coach when a new request arrives.
- Supabase Auth handles authentication emails.
- Unsaved conversations expire 90 days after the most recent activity.

## Coach Discovery

- `/coaches` filters coaches by their listed sport, optional training type, and optional location.
- Location search uses saved coach latitude/longitude, or resolves known city/state/ZIP values through the server-side lookup in `src/lib/location.ts`.
- Player/parent users can save coaches from profile pages and see saved coaches in `/account/dashboard`.
- Coach profile service cards are selectable. A selected service is included in the training request payload and saved when the request-service migration has been applied.
- Coaches manage day-by-day available hours in `/coach/calendar`. Saved availability appears on public profiles and powers the coach onboarding checklist.

## Routes

Public:

- `/`
- `/coaches`
- `/coaches/[slug]`
- `/account/login`
- `/account/register`
- `/coach/register`
- `/privacy`
- `/terms`

`Find Coaches` is the main discovery page. `/account/login` is the unified sign-in/sign-up page for Player/Parent Accounts and Coach Accounts.

Legacy redirects:

- `/for-coaches` redirects to `/coach/register`
- `/coach-register` redirects to `/coach/register`
- `/coach/login` redirects to `/account/login?role=coach`
- `/request-training` redirects to `/coaches`

Coach Dashboard:

- `/coach/forgot-password`
- `/coach/reset-password`
- `/coach/onboarding`
- `/coach/dashboard`
- `/coach/calendar`
- `/coach/profile`
- `/coach/profile/edit`
- `/coach/profile/preview`
- `/coach/messages`
- `/coach/messages/[conversationId]`
- `/coach/notifications`
- `/coach/settings/notifications`
- `/coach/players`
- `/coach/billing`
- `/coach/referrals`

Player/parent dashboard:

- `/account/verify-email`
- `/account/verify-phone`
- `/account/forgot-password`
- `/account/reset-password`
- `/account/onboarding`
- `/account/dashboard`
- `/account/preferences`
- `/account/settings`
- `/account/messages`
- `/account/messages/[conversationId]`
- `/account/notifications`
- `/account/settings/notifications`

Shared auth:

- `/auth/callback`

Admin:

- `/admin`
- `/admin/accounts`
- `/admin/accounts/[userId]`
- `/admin/coaches`
- `/admin/conversations`
- `/admin/reports`
- `/admin/bans`
- `/admin/subscriptions`
- `/admin/referrals`

`/admin/subscriptions` includes manual beta/premium access grants for coaches before automated billing is fully connected.

API:

- `/api/training-requests`
- `/api/push/subscribe`
- `/api/push/unsubscribe`
- `/api/push/test`
- `/api/jobs/parent-followups`
- `/api/jobs/retention`
- `/api/health/supabase`

## Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```
