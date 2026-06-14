import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import {
  createFoundingSubscriptionSchedule,
  getStripeSubscription,
  stripeWebhookSecret,
  verifyStripeWebhookPayload,
} from "@/lib/payments";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { Subscription, SubscriptionStatus, TrainingRequestPayment } from "@/lib/types";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: StripeObject;
  };
};

type StripeObject = Record<string, unknown> & {
  id?: string;
  payment_intent?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string | undefined>;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const secret = stripeWebhookSecret();

  if (!verifyStripeWebhookPayload({ rawBody, signatureHeader, secret })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as StripeEvent;

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event);
  } else if (event.type === "checkout.session.expired") {
    await markPaymentFromEvent(event, "expired");
  } else if (event.type === "payment_intent.payment_failed") {
    await markPaymentFromEvent(event, "failed");
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertCoachSubscriptionFromStripeSubscription(event.data.object, { eventId: event.id });
  } else if (event.type === "invoice.payment_succeeded") {
    await handleInvoicePaymentEvent(event, "succeeded");
  } else if (event.type === "invoice.payment_failed") {
    await handleInvoicePaymentEvent(event, "failed");
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(event: StripeEvent) {
  const session = event.data.object;
  const paymentId = session.metadata?.payment_id;

  if (!paymentId) {
    await handleCoachSubscriptionCheckoutCompleted(event);
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: payment, error } = await supabase
    .from("training_request_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle<TrainingRequestPayment>();

  if (error || !payment || payment.status === "paid") {
    if (error) {
      console.error("[stripe webhook] payment lookup failed", {
        paymentId,
        eventId: event.id,
        message: error.message,
        code: error.code,
      });
    }
    return;
  }

  const now = new Date().toISOString();
  await supabase
    .from("training_request_payments")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id ?? payment.stripe_checkout_session_id,
      stripe_payment_intent_id: session.payment_intent ?? payment.stripe_payment_intent_id,
      stripe_payment_status: session.payment_status ?? "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", payment.id);

  if (payment.training_session_id) {
    await supabase
      .from("training_sessions")
      .update({
        status: "paid_confirmed",
        payment_status: "paid",
        paid_at: now,
        updated_at: now,
      })
      .eq("id", payment.training_session_id);
  }

  if (payment.session_kind === "first_session" && payment.training_request_id) {
    await supabase
      .from("training_requests")
      .update({
        status: "paid_confirmed",
        payment_status: "paid",
        stripe_checkout_session_id: session.id ?? payment.stripe_checkout_session_id,
        stripe_payment_intent_id: session.payment_intent ?? payment.stripe_payment_intent_id,
        paid_confirmed_at: now,
        updated_at: now,
      })
      .eq("id", payment.training_request_id);
  }

  if (payment.conversation_id) {
    await supabase
      .from("conversations")
      .update({ status: "scheduled", updated_at: now, last_message_at: now })
      .eq("id", payment.conversation_id);

    await supabase.from("messages").insert({
      conversation_id: payment.conversation_id,
      sender_user_id: null,
      sender_role: "system",
      body:
        payment.session_kind === "first_session"
          ? "Payment confirmed through Reppy. The first session booking is now confirmed."
          : "Payment confirmed through Reppy for the future session.",
    });

    await notifyParticipants({
      conversationId: payment.conversation_id,
      type: "payment_completed",
      title: "Payment confirmed",
      body:
        payment.session_kind === "first_session"
          ? "The first session booking is confirmed."
          : "The future session payment is confirmed.",
    });
  }
}

async function handleCoachSubscriptionCheckoutCompleted(event: StripeEvent) {
  const session = event.data.object;
  const metadata = session.metadata ?? {};
  const kind = metadata.kind;
  const planCode = metadata.plan_code;
  const coachUserId = metadata.coach_user_id;
  const subscriptionId = getString(session.subscription);

  if (kind !== "coach_subscription" && !planCode && !coachUserId) {
    return;
  }

  if (!subscriptionId || !coachUserId) {
    console.error("[stripe webhook] coach subscription checkout missing identifiers", {
      eventId: event.id,
      sessionId: session.id,
      hasSubscriptionId: Boolean(subscriptionId),
      hasCoachUserId: Boolean(coachUserId),
    });
    return;
  }

  let subscription: StripeObject;
  try {
    subscription = (await getStripeSubscription(subscriptionId)) as StripeObject;
  } catch (error) {
    console.error("[stripe webhook] subscription lookup after checkout failed", {
      eventId: event.id,
      subscriptionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const offerDurationMonths = numberFromMetadata(metadata.offer_duration_months);
  const offerDurationType = metadata.offer_duration_type;
  let scheduleId = getString(subscription.schedule);

  if (planCode === "founding_599" && offerDurationMonths && offerDurationType !== "lifetime" && !scheduleId) {
    try {
      scheduleId = await createFoundingSubscriptionSchedule({
        subscriptionId,
        durationMonths: offerDurationMonths,
      });
    } catch (error) {
      console.error("[stripe webhook] founding subscription schedule creation failed", {
        eventId: event.id,
        subscriptionId,
        offerId: metadata.offer_id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await upsertCoachSubscriptionFromStripeSubscription(subscription, {
    eventId: event.id,
    fallbackMetadata: metadata,
    checkoutSessionId: session.id,
    scheduleId,
  });

  if (metadata.offer_id) {
    await markCoachOfferRedeemedFromSubscription({
      offerId: metadata.offer_id,
      coachUserId,
      coachId: metadata.coach_id ?? null,
      subscriptionId,
      scheduleId,
      stripePriceId: getSubscriptionPriceId(subscription),
      eventId: event.id,
    });
  }
}

async function upsertCoachSubscriptionFromStripeSubscription(
  subscription: StripeObject,
  {
    eventId,
    fallbackMetadata = {},
    checkoutSessionId,
    scheduleId,
    invoiceStatus,
  }: {
    eventId: string;
    fallbackMetadata?: Record<string, string | undefined>;
    checkoutSessionId?: string | null;
    scheduleId?: string | null;
    invoiceStatus?: string | null;
  },
) {
  const subscriptionId = subscription.id;
  if (!subscriptionId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Subscription>();

  if (existingError) {
    console.error("[stripe webhook] existing subscription lookup failed", {
      eventId,
      subscriptionId,
      message: existingError.message,
      code: existingError.code,
    });
  }

  const metadata = {
    ...fallbackMetadata,
    ...(subscription.metadata ?? {}),
  };
  const coachUserId = metadata.coach_user_id || existing?.coach_user_id || null;

  if (!coachUserId) {
    console.error("[stripe webhook] subscription event missing coach_user_id", {
      eventId,
      subscriptionId,
    });
    return;
  }

  const status = stripeSubscriptionStatus(subscription, eventId);
  const currentPeriodStart = stripeTimestampToIso(subscription.current_period_start);
  const currentPeriodEnd = stripeTimestampToIso(subscription.current_period_end);
  const activeAccess = ["active", "trialing", "canceling"].includes(status);
  const payload = {
    coach_user_id: coachUserId,
    coach_id: metadata.coach_id || existing?.coach_id || null,
    provider_customer_id: getString(subscription.customer) || existing?.provider_customer_id || null,
    provider_subscription_id: subscriptionId,
    plan_code: metadata.plan_code || existing?.plan_code || "premium_monthly",
    status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    access_ends_at: activeAccess ? currentPeriodEnd : null,
    founding_price_locked: (metadata.plan_code || existing?.plan_code) === "founding_599",
    coach_access_offer_id: metadata.offer_id || existing?.coach_access_offer_id || null,
    stripe_price_id: getSubscriptionPriceId(subscription) || existing?.stripe_price_id || null,
    stripe_subscription_schedule_id:
      scheduleId || getString(subscription.schedule) || existing?.stripe_subscription_schedule_id || null,
    stripe_checkout_session_id: checkoutSessionId || existing?.stripe_checkout_session_id || null,
    last_invoice_status: invoiceStatus || existing?.last_invoice_status || null,
    updated_at: new Date().toISOString(),
  };

  const result = existing?.id
    ? await supabase.from("subscriptions").update(payload).eq("id", existing.id)
    : await supabase.from("subscriptions").insert({ ...payload, created_at: new Date().toISOString() });

  if (result.error) {
    console.error("[stripe webhook] subscription upsert failed", {
      eventId,
      subscriptionId,
      coachUserId,
      message: result.error.message,
      code: result.error.code,
    });
  }
}

async function markCoachOfferRedeemedFromSubscription({
  offerId,
  coachUserId,
  coachId,
  subscriptionId,
  scheduleId,
  stripePriceId,
  eventId,
}: {
  offerId: string;
  coachUserId: string;
  coachId: string | null;
  subscriptionId: string;
  scheduleId: string | null;
  stripePriceId: string | null;
  eventId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: offer, error } = await supabase
    .from("coach_access_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle<{
      id: string;
      user_id: string | null;
      redeemed_count: number;
      max_redemptions: number;
      redeemed_at: string | null;
      revoked_at: string | null;
    }>();

  if (error || !offer) {
    if (error) {
      console.error("[stripe webhook] offer lookup failed", {
        eventId,
        offerId,
        message: error.message,
        code: error.code,
      });
    }
    return;
  }

  if (offer.revoked_at || (offer.user_id && offer.user_id !== coachUserId)) {
    console.error("[stripe webhook] offer redemption rejected", {
      eventId,
      offerId,
      coachUserId,
      claimedUserId: offer.user_id,
      revoked: Boolean(offer.revoked_at),
    });
    return;
  }

  const now = new Date().toISOString();
  const firstRedemptionForUser = !offer.redeemed_at || offer.user_id !== coachUserId;
  const { error: updateError } = await supabase
    .from("coach_access_offers")
    .update({
      user_id: coachUserId,
      coach_id: coachId,
      redeemed_count: firstRedemptionForUser
        ? Math.min(offer.max_redemptions, offer.redeemed_count + 1)
        : offer.redeemed_count,
      redeemed_at: offer.redeemed_at ?? now,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_schedule_id: scheduleId,
      stripe_price_id: stripePriceId,
      updated_at: now,
    })
    .eq("id", offerId);

  if (updateError) {
    console.error("[stripe webhook] offer redemption update failed", {
      eventId,
      offerId,
      message: updateError.message,
      code: updateError.code,
    });
  }
}

async function handleInvoicePaymentEvent(event: StripeEvent, invoiceStatus: "succeeded" | "failed") {
  const invoice = event.data.object;
  const subscriptionId = getString(invoice.subscription);

  if (!subscriptionId) {
    return;
  }

  if (invoiceStatus === "failed") {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "past_due",
        access_ends_at: null,
        last_invoice_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("provider_subscription_id", subscriptionId);

    if (error) {
      console.error("[stripe webhook] invoice failure subscription update failed", {
        eventId: event.id,
        subscriptionId,
        message: error.message,
        code: error.code,
      });
    }
    return;
  }

  try {
    const subscription = (await getStripeSubscription(subscriptionId)) as StripeObject;
    await upsertCoachSubscriptionFromStripeSubscription(subscription, {
      eventId: event.id,
      invoiceStatus: "succeeded",
    });
  } catch (error) {
    console.error("[stripe webhook] invoice success subscription lookup failed", {
      eventId: event.id,
      subscriptionId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function markPaymentFromEvent(event: StripeEvent, status: "expired" | "failed") {
  const paymentId = event.data.object.metadata?.payment_id;

  if (!paymentId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const timestampColumn = status === "expired" ? "expired_at" : "failed_at";
  const now = new Date().toISOString();
  const { data: payment } = await supabase
    .from("training_request_payments")
    .update({ status, [timestampColumn]: now, updated_at: now })
    .eq("id", paymentId)
    .neq("status", "paid")
    .select("*")
    .maybeSingle<TrainingRequestPayment>();

  if (!payment) {
    return;
  }

  if (payment.training_request_id) {
    await supabase
      .from("training_requests")
      .update({ payment_status: status, updated_at: now })
      .eq("id", payment.training_request_id)
      .neq("payment_status", "paid");
  }

  if (payment.training_session_id) {
    await supabase
      .from("training_sessions")
      .update({ payment_status: status, updated_at: now })
      .eq("id", payment.training_session_id)
      .neq("payment_status", "paid");
  }
}

function getString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

function numberFromMetadata(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stripeTimestampToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function stripeSubscriptionStatus(subscription: StripeObject, eventId: string): SubscriptionStatus {
  const status = typeof subscription.status === "string" ? subscription.status : "active";
  if (status === "trialing") {
    return "trialing";
  }

  if (status === "active") {
    return subscription.cancel_at_period_end ? "canceling" : "active";
  }

  if (status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired") {
    return "past_due";
  }

  if (status === "canceled") {
    return "canceled";
  }

  console.info("[stripe webhook] unmapped subscription status treated as past_due", {
    eventId,
    stripeStatus: status,
  });
  return "past_due";
}

function getSubscriptionPriceId(subscription: StripeObject) {
  const items = subscription.items;
  if (!items || typeof items !== "object" || !("data" in items) || !Array.isArray(items.data)) {
    return null;
  }

  const firstItem = items.data[0] as Record<string, unknown> | undefined;
  const price = firstItem?.price;
  if (!price || typeof price !== "object" || !("id" in price) || typeof price.id !== "string") {
    return null;
  }

  return price.id;
}

async function notifyParticipants({
  conversationId,
  type,
  title,
  body,
}: {
  conversationId: string;
  type: "payment_completed";
  title: string;
  body: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("user_id, role")
    .eq("conversation_id", conversationId);

  for (const participant of participants ?? []) {
    if (!participant.user_id) {
      continue;
    }

    await createNotification({
      userId: participant.user_id,
      type,
      title,
      body,
      relatedConversationId: conversationId,
      actionUrl: participant.role === "coach" ? `/coach/messages/${conversationId}` : `/account/messages/${conversationId}`,
    });

    await sendPushNotificationToUser(participant.user_id, {
      title,
      body,
      url: participant.role === "coach" ? `/coach/messages/${conversationId}` : `/account/messages/${conversationId}`,
      tag: `conversation-${conversationId}`,
    });
  }
}
