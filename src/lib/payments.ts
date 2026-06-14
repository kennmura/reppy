import crypto from "node:crypto";
import { appUrl } from "./email";

export const requestLifecycleStatuses = [
  "pending",
  "accepted_pending_payment",
  "paid_confirmed",
  "declined",
  "cancelled",
  "completed",
  "refunded",
] as const;

export const paymentStatuses = [
  "not_required",
  "requires_payment",
  "checkout_created",
  "paid",
  "coach_direct_pending",
  "coach_marked_paid",
  "failed",
  "expired",
  "refunded",
] as const;

export function platformFeeBps() {
  const parsed = Number.parseInt(process.env.REPPY_PLATFORM_FEE_BPS ?? "500", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

export function calculatePaymentAmounts(grossAmountCents: number) {
  const platformFeeCents = Math.round((grossAmountCents * platformFeeBps()) / 10_000);
  return {
    grossAmountCents,
    platformFeeCents,
    coachPayoutCents: Math.max(0, grossAmountCents - platformFeeCents),
  };
}

export function parsePriceToCents(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) {
    return null;
  }

  const dollars = Number.parseFloat(match[1]);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return null;
  }

  return Math.round(dollars * 100);
}

export function formatMoney(cents: number | null | undefined, currency = "usd") {
  if (typeof cents !== "number") {
    return "Not set";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

export function hasStripeCheckoutConfig() {
  return Boolean(stripeSecretKey());
}

export type CheckoutSessionInput = {
  paymentId: string;
  trainingRequestId: string | null;
  trainingSessionId: string | null;
  conversationId: string | null;
  requesterUserId: string | null;
  requesterEmail: string | null;
  coachName: string;
  serviceTitle: string;
  amountCents: number;
  platformFeeCents: number;
  currency: string;
  connectedAccountId?: string | null;
};

export type CheckoutSessionResult = {
  id: string;
  url: string;
  paymentIntentId: string | null;
};

export async function createStripeCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", appUrl(`/account/messages/${input.conversationId}?payment=success`));
  params.set("cancel_url", appUrl(`/account/messages/${input.conversationId}?payment=cancelled`));
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set("line_items[0][price_data][product_data][name]", input.serviceTitle);
  params.set("line_items[0][price_data][product_data][description]", `Training session with ${input.coachName}`);
  params.set("metadata[payment_id]", input.paymentId);
  params.set("metadata[training_request_id]", input.trainingRequestId ?? "");
  params.set("metadata[training_session_id]", input.trainingSessionId ?? "");
  params.set("metadata[conversation_id]", input.conversationId ?? "");
  params.set("metadata[requester_user_id]", input.requesterUserId ?? "");
  params.set("payment_intent_data[metadata][payment_id]", input.paymentId);
  params.set("payment_intent_data[metadata][training_request_id]", input.trainingRequestId ?? "");
  params.set("payment_intent_data[metadata][training_session_id]", input.trainingSessionId ?? "");

  if (input.requesterEmail) {
    params.set("customer_email", input.requesterEmail);
  }

  if (input.connectedAccountId) {
    params.set("payment_intent_data[application_fee_amount]", String(input.platformFeeCents));
    params.set("payment_intent_data[transfer_data][destination]", input.connectedAccountId);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = (await response.json().catch(() => null)) as
    | {
        id?: string;
        url?: string;
        payment_intent?: string | null;
        error?: { message?: string };
      }
    | null;

  if (!response.ok || !data?.id || !data.url) {
    throw new Error(data?.error?.message ?? `Stripe checkout failed with status ${response.status}.`);
  }

  return {
    id: data.id,
    url: data.url,
    paymentIntentId: data.payment_intent ?? null,
  };
}

export function verifyStripeWebhookPayload({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}) {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const expectedSignature = parts.v1;

  if (!timestamp || !expectedSignature) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return timingSafeEqual(digest, expectedSignature);
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
