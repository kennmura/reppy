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

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_COACH_PREMIUM_MONTHLY_PRICE_ID=
STRIPE_COACH_PREMIUM_ANNUAL_PRICE_ID=
STRIPE_COACH_FOUNDING_MONTHLY_PRICE_ID=
REPPY_PLATFORM_FEE_BPS=500
STRIPE_CONNECT_CLIENT_ID=
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

## Training Request Payments

- Parents/players submit requests from coach profiles.
- Coaches accept or decline requests from the coach Message Center.
- First sessions require Reppy payment after coach acceptance.
- The app creates Stripe Checkout server-side only; the browser never chooses the amount.
- Stripe webhook confirmation at `/api/stripe/webhook` is required before a first session becomes `paid_confirmed`.
- `REPPY_PLATFORM_FEE_BPS=500` records a 5% platform fee for Reppy platform payments.
- Future sessions can use direct coach payment or Reppy payment depending on coach preferences.
- Configure Stripe webhook delivery for local or deployed testing and set `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## Coach Premium Billing

- Public coach premium plans are `$15.99/month` and `$160.99/year`.
- Admins can grant free premium access or private `$5.99/month` founding subscription eligibility in `/admin/coach-promo`.
- The `$5.99/month` founding plan is never a public promo code and there is no user-entered promo-code box.
- The billing page sends only safe plan codes: `premium_monthly`, `premium_annual`, or `founding_599`.
- The server chooses the Stripe price ID after checking the authenticated coach email against `coach_access_offers`.
- Free premium offers create internal `premium_access_grants` and do not require Stripe checkout.
- Limited 3/6/12-month founding offers use Stripe subscription schedules from the hidden `$5.99/month` price to the public `$15.99/month` price.
- Lifetime founding offers stay on the hidden `$5.99/month` recurring price while the subscription remains active.

Manual Stripe setup:

- Create a Premium monthly recurring price for `$15.99/month` and set `STRIPE_COACH_PREMIUM_MONTHLY_PRICE_ID`.
- Create a Premium annual recurring price for `$160.99/year` and set `STRIPE_COACH_PREMIUM_ANNUAL_PRICE_ID`.
- Create a hidden Founding monthly recurring price for `$5.99/month` and set `STRIPE_COACH_FOUNDING_MONTHLY_PRICE_ID`.
- Do not create public promo codes, Stripe promotion codes, or coupons for the founding rate.
- Configure Stripe webhook delivery to `/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, and `invoice.payment_failed`.
- Configure the Stripe Customer Portal before exposing self-service cancellation or payment-method management links.

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
- `/admin/coach-promo`
- `/admin/referrals`

`/admin/subscriptions` includes manual beta/premium access grants for coaches before automated billing is fully connected.
`/admin/coach-promo` manages email-approved free premium and hidden founding-rate offers.

API:

- `/api/training-requests`
- `/api/stripe/webhook`
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
