type EmailPayload = {
  to: string | null | undefined;
  subject: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export async function sendPlatformEmail(payload: EmailPayload) {
  const safePayload = {
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    ctaLabel: payload.ctaLabel,
    ctaUrl: payload.ctaUrl,
  };

  if (!process.env.EMAIL_PROVIDER_API_KEY) {
    console.info("[email:development-log]", safePayload);
    return { sent: false, logged: true };
  }

  console.info("[email:provider-not-configured]", safePayload);
  return { sent: false, logged: true };
}

export function appUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002";
  return `${baseUrl}${path}`;
}
