type FreeCoachAlertPayload = {
  to: string | null | undefined;
  sport: string | null | undefined;
  ageRange: string | null | undefined;
  generalLocation: string | null | undefined;
  requestType: string | null | undefined;
  conversationUrl: string;
};

type CoachReviewInviteEmailPayload = {
  to: string | null | undefined;
  coachName: string;
  inviteUrl: string;
  note?: string | null;
};

type EmailResult = {
  sent: boolean;
  skipped?: boolean;
  logged?: boolean;
  error?: string;
};

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

export async function sendCoachReviewInviteEmail({
  to,
  coachName,
  inviteUrl,
  note,
}: CoachReviewInviteEmailPayload): Promise<EmailResult> {
  const enabled = process.env.FREE_COACH_ALERT_EMAILS_ENABLED === "true";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM || "Reppy <notifications@yourdomain.com>";
  const safePayload = {
    to,
    subject: `${coachName} invited you to leave a Reppy review`,
    coachName,
    inviteUrl,
    note: note || null,
  };

  if (!to) {
    return { sent: false, skipped: true, error: "missing-recipient" };
  }

  if (!enabled || !apiKey) {
    console.info("[coach-review-invite:development-log]", safePayload);
    return { sent: false, logged: true, error: enabled ? "missing-resend-api-key" : "disabled" };
  }

  const text = [
    `${coachName} invited you to leave a review on Reppy.`,
    "",
    note ? `Coach note: ${note}` : "",
    "",
    "You will need a lightweight Reppy account to submit the review. Reppy will not show your email address publicly.",
    "",
    `Leave review: ${inviteUrl}`,
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");

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
        subject: safePayload.subject,
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
