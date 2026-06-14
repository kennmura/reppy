import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyStripeWebhookPayload, stripeWebhookSecret } from "@/lib/payments";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { TrainingRequestPayment } from "@/lib/types";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      payment_intent?: string | null;
      payment_status?: string | null;
      metadata?: Record<string, string | undefined>;
    };
  };
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
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(event: StripeEvent) {
  const session = event.data.object;
  const paymentId = session.metadata?.payment_id;

  if (!paymentId) {
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
