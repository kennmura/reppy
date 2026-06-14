type FreeCoachAlertPayload = {
  to: string | null | undefined;
  sport: string | null | undefined;
  ageRange: string | null | undefined;
  generalLocation: string | null | undefined;
  requestType: string | null | undefined;
  conversationUrl: string;
};

type EmailResult = {
  sent: boolean;
  skipped?: boolean;
  logged?: boolean;
  error?: string;
};

export function appUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002";
  return `${baseUrl}${path}`;
}

export async function sendFreeCoachLockedRequestEmail({
  to,
  sport,
  ageRange,
  generalLocation,
  requestType,
  conversationUrl,
}: FreeCoachAlertPayload): Promise<EmailResult> {
  const enabled = process.env.FREE_COACH_ALERT_EMAILS_ENABLED === "true";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM || "Reppy <notifications@yourdomain.com>";
  const safePayload = {
    to,
    subject: "You have a new training request waiting",
    sport: sport || "Training",
    ageRange: ageRange || "Not provided",
    generalLocation: generalLocation || "Area not provided",
    requestType: requestType || "Training request",
    ctaUrl: conversationUrl,
  };

  if (!to) {
    return { sent: false, skipped: true, error: "missing-recipient" };
  }

  if (!enabled || !apiKey) {
    console.info("[free-coach-alert:development-log]", safePayload);
    return { sent: false, logged: true, error: enabled ? "missing-resend-api-key" : "disabled" };
  }

  const text = [
    "A new training request has arrived in your Message Center.",
    "",
    `Sport: ${safePayload.sport}`,
    `Player age range: ${safePayload.ageRange}`,
    `General area: ${safePayload.generalLocation}`,
    `Training type: ${safePayload.requestType}`,
    "",
    "Start your free trial or upgrade to view the full request and respond.",
    "",
    `Open Message Center: ${conversationUrl}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "You have a new training request waiting",
        text,
      }),
    });

    if (!response.ok) {
      return { sent: false, error: `resend-${response.status}` };
    }

    return { sent: true };
  } catch {
    return { sent: false, error: "delivery-failed" };
  }
}
