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

export type CoachSubscriptionPlanCode = "premium_monthly" | "premium_annual" | "founding_599";

export function stripeCoachPriceIdForPlan(planCode: CoachSubscriptionPlanCode) {
  switch (planCode) {
    case "premium_monthly":
      return process.env.STRIPE_COACH_PREMIUM_MONTHLY_PRICE_ID ?? "";
    case "premium_annual":
      return process.env.STRIPE_COACH_PREMIUM_ANNUAL_PRICE_ID ?? "";
    case "founding_599":
      return process.env.STRIPE_COACH_FOUNDING_MONTHLY_PRICE_ID ?? "";
  }
}

export function hasStripeCoachSubscriptionConfig(planCode: CoachSubscriptionPlanCode) {
  return Boolean(stripeSecretKey() && stripeCoachPriceIdForPlan(planCode));
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

export type SubscriptionCheckoutSessionInput = {
  coachUserId: string;
  coachId: string;
  coachName: string;
  coachEmail: string | null;
  planCode: CoachSubscriptionPlanCode;
  offerId?: string | null;
  offerDurationMonths?: number | null;
  offerDurationType?: string | null;
};

export type SubscriptionCheckoutSessionResult = {
  id: string;
  url: string;
};

export type BillingPortalSessionResult = {
  id: string;
  url: string;
};

export type StripeConnectAccountResult = {
  id: string;
};

export type StripeConnectOnboardingLinkResult = {
  url: string;
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

export async function createStripeSubscriptionCheckoutSession(
  input: SubscriptionCheckoutSessionInput,
): Promise<SubscriptionCheckoutSessionResult> {
  const secretKey = stripeSecretKey();
  const priceId = stripeCoachPriceIdForPlan(input.planCode);
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${input.planCode}.`);
  }

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", appUrl("/coach/billing?billing=checkout-success"));
  params.set("cancel_url", appUrl("/coach/billing?billing=checkout-cancelled"));
  params.set("client_reference_id", input.coachUserId);
  if (input.coachEmail) {
    params.set("customer_email", input.coachEmail);
  }
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", priceId);
  params.set("metadata[kind]", "coach_subscription");
  params.set("metadata[coach_user_id]", input.coachUserId);
  params.set("metadata[coach_id]", input.coachId);
  params.set("metadata[plan_code]", input.planCode);
  params.set("metadata[offer_id]", input.offerId ?? "");
  params.set("metadata[offer_duration_months]", input.offerDurationMonths ? String(input.offerDurationMonths) : "");
  params.set("metadata[offer_duration_type]", input.offerDurationType ?? "");
  params.set("subscription_data[metadata][kind]", "coach_subscription");
  params.set("subscription_data[metadata][coach_user_id]", input.coachUserId);
  params.set("subscription_data[metadata][coach_id]", input.coachId);
  params.set("subscription_data[metadata][plan_code]", input.planCode);
  params.set("subscription_data[metadata][offer_id]", input.offerId ?? "");
  params.set(
    "subscription_data[metadata][offer_duration_months]",
    input.offerDurationMonths ? String(input.offerDurationMonths) : "",
  );
  params.set("subscription_data[metadata][offer_duration_type]", input.offerDurationType ?? "");

  const response = await stripePost("https://api.stripe.com/v1/checkout/sessions", params);
  const data = response as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!data.id || !data.url) {
    throw new Error(data.error?.message ?? "Stripe subscription checkout did not return a URL.");
  }

  return {
    id: data.id,
    url: data.url,
  };
}

export async function createStripeBillingPortalSession({
  customerId,
  returnPath = "/coach/billing",
}: {
  customerId: string;
  returnPath?: string;
}): Promise<BillingPortalSessionResult> {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", appUrl(returnPath));

  const data = (await stripePost("https://api.stripe.com/v1/billing_portal/sessions", params)) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!data.id || !data.url) {
    throw new Error(data.error?.message ?? "Stripe billing portal did not return a URL.");
  }

  return {
    id: data.id,
    url: data.url,
  };
}

export async function createStripeConnectExpressAccount({
  coachUserId,
  coachId,
  email,
}: {
  coachUserId: string;
  coachId: string;
  email: string | null;
}): Promise<StripeConnectAccountResult> {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const params = new URLSearchParams();
  params.set("type", "express");
  params.set("country", "US");
  if (email) {
    params.set("email", email);
  }
  params.set("capabilities[card_payments][requested]", "true");
  params.set("capabilities[transfers][requested]", "true");
  params.set("metadata[coach_user_id]", coachUserId);
  params.set("metadata[coach_id]", coachId);

  const data = (await stripePost("https://api.stripe.com/v1/accounts", params)) as {
    id?: string;
    error?: { message?: string };
  };

  if (!data.id) {
    throw new Error(data.error?.message ?? "Stripe Connect account was not created.");
  }

  return { id: data.id };
}

export async function createStripeConnectOnboardingLink({
  accountId,
}: {
  accountId: string;
}): Promise<StripeConnectOnboardingLinkResult> {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const params = new URLSearchParams();
  params.set("account", accountId);
  params.set("type", "account_onboarding");
  params.set("refresh_url", appUrl("/coach/billing?connect=refresh"));
  params.set("return_url", appUrl("/coach/billing?connect=return"));

  const data = (await stripePost("https://api.stripe.com/v1/account_links", params)) as {
    url?: string;
    error?: { message?: string };
  };

  if (!data.url) {
    throw new Error(data.error?.message ?? "Stripe Connect onboarding link was not created.");
  }

  return { url: data.url };
}

export async function getStripeSubscription(subscriptionId: string) {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !data?.id) {
    const error = data?.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Stripe subscription lookup failed with status ${response.status}.`);
  }

  return data;
}

export async function createFoundingSubscriptionSchedule({
  subscriptionId,
  durationMonths,
}: {
  subscriptionId: string;
  durationMonths: number;
}) {
  const foundingPriceId = stripeCoachPriceIdForPlan("founding_599");
  const premiumMonthlyPriceId = stripeCoachPriceIdForPlan("premium_monthly");

  if (!foundingPriceId || !premiumMonthlyPriceId) {
    throw new Error("Missing founding or premium monthly Stripe price ID.");
  }

  const createParams = new URLSearchParams();
  createParams.set("from_subscription", subscriptionId);
  const schedule = (await stripePost("https://api.stripe.com/v1/subscription_schedules", createParams)) as {
    id?: string;
    phases?: Array<{ start_date?: number }>;
  };

  if (!schedule.id) {
    throw new Error("Stripe subscription schedule was not created.");
  }

  const updateParams = new URLSearchParams();
  const phaseStart = schedule.phases?.[0]?.start_date ?? Math.floor(Date.now() / 1000);
  const foundingPhaseEnd = addMonthsToUnixTimestamp(phaseStart, durationMonths);

  updateParams.set("end_behavior", "release");
  updateParams.set("phases[0][start_date]", String(phaseStart));
  updateParams.set("phases[0][end_date]", String(foundingPhaseEnd));
  updateParams.set("phases[0][items][0][price]", foundingPriceId);
  updateParams.set("phases[0][items][0][quantity]", "1");
  updateParams.set("phases[1][start_date]", String(foundingPhaseEnd));
  updateParams.set("phases[1][items][0][price]", premiumMonthlyPriceId);
  updateParams.set("phases[1][items][0][quantity]", "1");
  updateParams.set("phases[1][metadata][reppy_price_switch]", "founding_to_premium");

  await stripePost(`https://api.stripe.com/v1/subscription_schedules/${encodeURIComponent(schedule.id)}`, updateParams);
  return schedule.id;
}

function addMonthsToUnixTimestamp(timestamp: number, months: number) {
  const date = new Date(timestamp * 1000);
  date.setUTCMonth(date.getUTCMonth() + months);
  return Math.floor(date.getTime() / 1000);
}

async function stripePost(url: string, params: URLSearchParams) {
  const secretKey = stripeSecretKey();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data?.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Stripe request failed with status ${response.status}.`);
  }

  return data ?? {};
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
