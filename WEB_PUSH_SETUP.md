# Web Push Setup

Reppy uses standards-based browser web push. No native mobile app is required.

## 1. Install Dependencies

Dependencies are included in `package.json`:

```bash
npm install
```

## 2. Generate VAPID Keys

Run:

```bash
npm run push:generate-keys
```

Copy the generated values into `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your_email@example.com
```

Do not commit generated keys. The private key must remain server-only.

## 3. Service Worker and Manifest

The app includes:

```text
public/push-sw.js
public/manifest.webmanifest
public/reppy-icon.svg
```

The service worker:

- Displays generic notification text.
- Opens or focuses the relevant Reppy route on click.
- Ignores malformed payloads.
- Never embeds secret keys.

## 4. Test Desktop Push

1. Start the app.
2. Sign in with a verified Supabase Auth user.
3. Open `/coach/settings/notifications` or `/account/settings/notifications`.
4. Click `Enable push`.
5. Use `POST /api/push/test` while signed in as `ADMIN_EMAIL`.

## 5. Test Android

1. Open the deployed HTTPS site in Chrome.
2. Sign in.
3. Enable push from notification settings.
4. Trigger a request or test push.

## 6. Test iPhone

On iOS, web push may require installing the site to the Home Screen.

1. Open the deployed HTTPS site in Safari.
2. Add Reppy to the Home Screen.
3. Open the installed app.
4. Sign in.
5. Enable notifications from settings.

## 7. Remove Stale Subscriptions

Expired subscriptions are marked inactive when push delivery returns a stale endpoint response.

You can also disable push on the current device from notification settings.

## 8. Troubleshooting

- If permission is denied, change notification permissions in browser or device settings.
- If the VAPID public key is missing, the settings page shows push as unavailable.
- Push payloads should never contain full private messages, names, email addresses, phone numbers, or exact locations.
