# Reppy Private Beta Launch Checklist

This checklist prepares a Vercel deployment for private beta. Do not switch Stripe to live mode until a human intentionally sets live keys and live price IDs.

## Local Verification

- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Run `npx supabase migration list` and confirm local and remote migrations are aligned.
- Run `npx supabase db lint --linked` and resolve schema or RLS errors before launch.
- Run `node scripts/verify-stripe-prices.mjs` with test-mode keys to verify the configured test prices.
- Confirm `/api/stripe/webhook` receives the raw request body. The route uses `runtime = "nodejs"` and `request.text()`, which is compatible with Vercel serverless functions.
- Confirm browser push assets are deployed from `public/push-sw.js`, `public/manifest.webmanifest`, and `public/reppy-icon.svg`.

## Vercel Environment Variables

Production must use the production Supabase project, production app domain, and live Stripe keys only after the live Stripe dashboard setup is complete.

Required Production variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `CRON_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `FREE_COACH_ALERT_EMAILS_ENABLED`
- `RESEND_API_KEY`
- `ALERT_EMAIL_FROM`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_COACH_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_COACH_PREMIUM_ANNUAL_PRICE_ID`
- `STRIPE_COACH_FOUNDING_MONTHLY_PRICE_ID`
- `REPPY_PLATFORM_FEE_BPS`
- `STRIPE_CONNECT_CLIENT_ID` if Connect OAuth is used
- `REPPY_DISABLE_PHONE_VERIFICATION=false` or omit it when phone verification should be required

Required Preview variables should use a staging or test Supabase project, the Vercel preview URL or a preview domain in `NEXT_PUBLIC_APP_URL`, and Stripe test-mode keys/prices/webhook secrets.

## Domain Setup

- Add the custom domain in Vercel and wait for DNS verification.
- Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` in Vercel Production.
- In Supabase Auth, set Site URL to the same production app URL.
- Add Supabase Redirect URLs:
  - `https://yourdomain.com/auth/callback`
  - the Vercel preview callback URL if preview auth testing is needed
- In Stripe, set webhook endpoint to `https://yourdomain.com/api/stripe/webhook`.
- In Stripe Connect settings, confirm return/refresh flows point back to Reppy paths generated from `NEXT_PUBLIC_APP_URL`, especially `/coach/billing?connect=return` and `/coach/billing?connect=refresh`.

## Supabase Readiness

- Confirm all migrations are applied with `npx supabase migration list`.
- Confirm `npx supabase db lint --linked` reports no schema errors.
- Dashboard-only settings to check:
  - Enable leaked password protection.
  - Configure custom SMTP for production auth emails.
  - Set Site URL and Redirect URLs for the production domain.
  - Confirm email templates mention the production brand/domain.
- RLS expectations:
  - `account_private_details` and DOB fields are readable/writeable only by the owning user or server-side admin code.
  - `messages`, `conversation_private_details`, `notifications`, `push_subscriptions`, and `notification_preferences` are scoped to participants or the owning user.
  - `training_requests` and `training_request_payments` are created by the owning parent/player flow and read by the target coach/server support flows.
  - `coach_access_offers`, premium grants, and admin-only data are managed through admin server actions, not public client access.
  - Public access is limited to intended public coach profile, service, media, testimonial, and availability data.

## Stripe Live Readiness

- Create live recurring prices:
  - Premium monthly: `$15.99/month`
  - Premium annual: `$160.99/year`
  - Hidden founding monthly: `$5.99/month`
- Do not create public promo codes or coupon flows for the founding rate.
- Configure the live webhook endpoint with these events:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Configure Stripe Billing Portal before exposing self-service subscription management.
- Configure Stripe Connect Express and complete platform verification requirements.
- Verify live prices without printing secrets: `node scripts/verify-stripe-prices.mjs --live`.
- The app rejects a test Stripe secret key in production Stripe API calls and rejects subscription IDs that are not Stripe `price_` values.

## Legal And Policy Review

- `/terms` and `/privacy` include draft payment, payout, refund, cancellation, no-show, coach-direct payment, guardian consent, and minor-safety language.
- These pages still need final review by a qualified legal/business reviewer before public launch.
- Decide final refund windows, cancellation cutoffs, no-show handling, weather policy, facility responsibility, and dispute escalation before inviting users outside private beta.

## Admin And Support Readiness

- Admin can view player/parent accounts, coach profiles, training requests, payment diagnostics, subscription diagnostics, access grants, coach promo offers, reports, and bans.
- Stripe IDs shown in admin diagnostics should be masked or truncated.
- Admin support views are read-only for request acceptance. Coaches accept or decline their own requests from Message Center.
- Support should use Stripe Dashboard for full payment, refund, subscription, and Connect investigations.

## Private Beta Smoke Test

- Create a beta coach account and complete coach onboarding.
- Complete Stripe Connect Express onboarding for that coach in the selected Stripe mode.
- Create a parent/player account and verify email/auth flow.
- Submit a training request to the coach.
- Have the coach accept the request from Message Center.
- Pay a small first-session amount through Stripe Checkout only after live-mode launch is explicitly approved.
- Confirm webhook delivery marks the request paid/confirmed and creates messages/notifications.
- Verify coach calendar, parent messages, coach messages, notification badges, and sign-out/session persistence.
- If a real live payment was used, refund it from Stripe Dashboard if appropriate and confirm Reppy status handling.

## Monitoring And Failure Handling

- Check Stripe Dashboard webhook deliveries and retry failures.
- Check Vercel function logs for `/api/stripe/webhook`, auth callbacks, training requests, push routes, and cron jobs.
- Check Supabase Auth logs, Postgres logs, and Realtime status.
- Keep a support email ready in site copy and email sender settings.
- Troubleshooting order: Vercel logs, Stripe event delivery, Supabase logs, admin request diagnostics, admin subscription diagnostics.

## Rollback Plan

- Roll back to the previous stable Vercel deployment if a production deploy fails.
- Disable or pause the Stripe webhook endpoint if duplicate or bad events are being processed.
- Remove live Stripe keys from Vercel or switch traffic back to the last good deployment if Checkout misbehaves.
- Revoke incorrect promo grants from `/admin/coach-promo` or `/admin/subscriptions`.
- Do not run destructive Supabase reset commands against the linked project.
