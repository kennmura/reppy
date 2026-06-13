# Reppy

Reppy is a Next.js App Router application for private sports coaching. Version 0 is a polished personal soccer coaching site for Kenshin Murakawa, structured so it can grow into a local coach directory.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- Supabase PostgreSQL, Auth, and future Storage
- Vercel-ready project structure

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
NEXT_PUBLIC_APP_URL=
FOUNDING_COACH_LIMIT=5
CRON_SECRET=
EMAIL_PROVIDER_API_KEY=
```

4. In Supabase SQL Editor, run:

```txt
supabase/schema.sql
supabase/seed.sql
```

5. Create a Supabase Auth user whose email matches `ADMIN_EMAIL`.

6. Start the app:

```bash
npm run dev
```

## Routes

- `/` renders Ken's coaching page.
- `/coaches` lists published coaches.
- `/coaches/ken-murakawa` renders Ken from coach data.
- `/for-coaches` explains the coach profile offer.
- `/contact` provides MVP contact routing.
- `/request-training` contains the standalone inquiry form.
- `/coach-register` lets interested coaches get on the directory radar.
- `/admin` is protected by Supabase Auth and `ADMIN_EMAIL`.
- `/admin/requests` manages training requests.
- `/admin/coaches` and `/admin/coaches/[id]` manage coach profile fields.
- `/admin/coach-applications` reviews coach registration leads.
- `/coach/messages` is the coach Message Centre with locked/free and premium/trial states.
- `/coach/billing`, `/coach/players`, and `/coach/referrals` prepare premium operations.
- `/privacy` and `/terms` are draft legal pages that require professional review.

## Notes

The public pages include fallback Ken data so the site can be viewed before Supabase is configured. Form submissions and admin reads/writes require Supabase environment variables and the service role key on the server.

Training requests now create conversations and first messages. If no email provider is configured, notification emails are logged safely in development.
