"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAccountContextOrRedirect,
  getAccountUserOrRedirect,
  getAuthenticatedUserOrRedirect,
  getCoachContextOrRedirect,
  getCoachUserOrRedirect,
  repairAccountForAuthUser,
} from "./auth";
import { calculateAgeFromDateOfBirth, isReasonablePlayerDateOfBirth } from "./accountProfile";
import { isPhoneVerificationBypassed } from "./accountConfig";
import { getMessageAccess, startCoachTrial } from "./entitlements";
import { isMissingCoachLocationColumnError, resolveCoachLocationFields } from "./location";
import {
  createNotification,
  deleteNotificationForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "./notifications";
import {
  calculatePaymentAmounts,
  createStripeCheckoutSession,
  formatMoney,
  hasStripeCheckoutConfig,
  parsePriceToCents,
} from "./payments";
import { scanForPublicContactInfo } from "./profileModeration";
import { sendPushNotificationToUser } from "./push";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase";
import type { Coach, CoachApplication, CoachProfileStatus, CoachService, TrainingRequest, TrainingRequestPayment, TrainingSession } from "./types";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fileValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function cleanFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/coach/profile/edit";
  }

  return value;
}

function safeCoachReturnPath(value: string, fallback = "/coach/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }

  if (!value.startsWith("/coach/")) {
    return fallback;
  }

  return value;
}

function safeAccountNext(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/account/dashboard";
  }

  return value;
}

function safeLoginPath(value: string, fallback: string) {
  return value === "/account/login" || value === "/account/login?role=coach" || value === "/coach/login"
    ? value
    : fallback;
}

function optionalInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function arrayTextValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value.trim() : ""));
}

function calculateProfileCompletion({
  coach,
  servicesCount,
  credentialsCount,
}: {
  coach: Partial<Coach>;
  servicesCount: number;
  credentialsCount: number;
}) {
  const checks = [
    coach.full_name,
    coach.slug,
    coach.sport,
    coach.headline,
    coach.bio && coach.bio.length >= 120,
    coach.location,
    coach.service_area,
    coach.profile_photo_url,
    coach.banner_image_url,
    coach.playing_experience,
    coach.coaching_experience,
    coach.training_approach,
    coach.age_groups,
    coach.skill_levels,
    coach.general_availability,
    servicesCount > 0,
    credentialsCount > 0,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

async function uploadCoachImage({
  coachId,
  file,
  folder,
}: {
  coachId: string;
  file: File | null;
  folder: "cover" | "profile";
}) {
  if (!file) {
    return null;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Coach images must be JPG, PNG, or WebP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Coach images must be 5MB or smaller.");
  }

  const supabase = createSupabaseAdminClient();
  const path = `${coachId}/${folder}/${Date.now()}-${cleanFileName(file.name)}`;
  const { error } = await supabase.storage.from("coach-media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("coach-media").getPublicUrl(path);
  return data.publicUrl;
}

async function requireAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    redirect("/admin/login?error=missing-admin-email");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || data.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/admin/login");
  }

  return data.user;
}

export async function signInAdmin(formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");

  if (!email || !password) {
    redirect("/admin/login?error=missing-fields");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/admin/login?error=invalid-login");
  }

  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function signInCoach(formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const loginPath = safeLoginPath(textValue(formData, "login_path"), "/account/login");

  if (!email || !password) {
    redirect(`${loginPath}?error=missing-fields`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`${loginPath}?error=invalid-login`);
  }

  const { profile } = await repairAccountForAuthUser(data.user);

  if (!profile || profile.role !== "coach" || profile.account_status !== "active") {
    redirect(`${loginPath}?error=wrong-role`);
  }

  if (!data.user.email_confirmed_at) {
    redirect(`${loginPath}?error=verify-email`);
  }

  redirect("/coach/dashboard");
}

export async function signOutCoach() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/account/login?role=coach");
}

export async function signOutAccount() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/account/login");
}

export async function signOutCurrentUser() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInAccount(formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const next = safeAccountNext(textValue(formData, "next"));

  if (!email || !password) {
    redirect("/account/login?error=missing-fields");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/account/login?error=invalid-login");
  }

  const { profile, privateDetails } = await repairAccountForAuthUser(data.user);

  if (!profile || !["parent", "adult_player"].includes(profile.role) || profile.account_status !== "active") {
    redirect("/account/login?error=wrong-role");
  }

  if (!data.user.email_confirmed_at && !profile.email_verified_at) {
    redirect("/account/login?error=verify-email");
  }

  const phoneVerified = privateDetails?.phone_verified_at || profile.phone_verified_at || data.user.phone_confirmed_at;

  if (!phoneVerified && !isPhoneVerificationBypassed() && next !== "/account/dashboard") {
    redirect(`/account/verify-phone?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export async function activateCoachTrial() {
  const { coachUserId, coach } = await getCoachContextOrRedirect();

  await startCoachTrial({
    coachUserId,
    foundingPriceLocked: Boolean(coach.founding_price_locked),
  });

  revalidatePath("/coach/messages");
  revalidatePath("/coach/billing");
  redirect("/coach/messages");
}

async function getTrainingRequestForCoach({
  requestId,
  conversationId,
  coachId,
}: {
  requestId: string;
  conversationId: string;
  coachId: string;
}) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("training_requests").select("*").eq("coach_id", coachId);

  if (requestId) {
    query = query.eq("id", requestId);
  } else {
    query = query.eq("conversation_id", conversationId);
  }

  const { data, error } = await query.maybeSingle<TrainingRequest>();

  if (error) {
    throw error;
  }

  return data;
}

async function getServicePriceCents({
  request,
  coach,
}: {
  request: TrainingRequest;
  coach: Coach;
}) {
  const supabase = createSupabaseAdminClient();
  let service: Pick<CoachService, "id" | "title" | "price"> | null = null;

  if (request.service_id) {
    const { data, error } = await supabase
      .from("coach_services")
      .select("id, title, price")
      .eq("id", request.service_id)
      .eq("coach_id", coach.id)
      .maybeSingle<Pick<CoachService, "id" | "title" | "price">>();

    if (error) {
      throw error;
    }

    service = data;
  }

  return {
    serviceTitle: service?.title ?? request.service_title ?? "Training session",
    amountCents: parsePriceToCents(service?.price) ?? parsePriceToCents(coach.pricing_text),
  };
}

async function upsertFirstTrainingSession({
  request,
  coach,
  amounts,
}: {
  request: TrainingRequest;
  coach: Coach;
  amounts: ReturnType<typeof calculatePaymentAmounts>;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const payload = {
    training_request_id: request.id,
    conversation_id: request.conversation_id ?? null,
    coach_id: coach.id,
    coach_user_id: coach.user_id ?? null,
    requester_user_id: request.requester_user_id ?? null,
    service_id: request.service_id ?? null,
    service_title: request.service_title ?? "Training session",
    session_kind: "first_session",
    status: "accepted_pending_payment",
    payment_status: "requires_payment",
    payment_method: "platform",
    requested_date: request.requested_date ?? null,
    requested_start_time: request.requested_start_time ?? null,
    requested_end_time: request.requested_end_time ?? null,
    timezone: request.timezone ?? coach.timezone ?? "America/New_York",
    preferred_days_times: request.preferred_days_times ?? null,
    location: request.preferred_location ?? null,
    gross_amount_cents: amounts.grossAmountCents,
    platform_fee_cents: amounts.platformFeeCents,
    coach_payout_cents: amounts.coachPayoutCents,
    currency: "usd",
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("training_request_id", request.id)
    .eq("session_kind", "first_session")
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("training_sessions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single<TrainingSession>();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("training_sessions")
    .insert({ ...payload, created_at: now })
    .select("*")
    .single<TrainingSession>();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertFirstTrainingPayment({
  request,
  coach,
  session,
  amounts,
}: {
  request: TrainingRequest;
  coach: Coach;
  session: TrainingSession;
  amounts: ReturnType<typeof calculatePaymentAmounts>;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const payload = {
    training_request_id: request.id,
    training_session_id: session.id,
    conversation_id: request.conversation_id ?? null,
    coach_id: coach.id,
    coach_user_id: coach.user_id ?? null,
    requester_user_id: request.requester_user_id ?? null,
    service_id: request.service_id ?? null,
    service_title: request.service_title ?? "Training session",
    session_kind: "first_session",
    payment_method: "platform",
    status: "requires_payment",
    gross_amount_cents: amounts.grossAmountCents,
    platform_fee_cents: amounts.platformFeeCents,
    coach_payout_cents: amounts.coachPayoutCents,
    currency: "usd",
    requested_date: request.requested_date ?? null,
    requested_start_time: request.requested_start_time ?? null,
    requested_end_time: request.requested_end_time ?? null,
    timezone: request.timezone ?? coach.timezone ?? "America/New_York",
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("training_request_payments")
    .select("id, status")
    .eq("training_request_id", request.id)
    .eq("session_kind", "first_session")
    .maybeSingle<Pick<TrainingRequestPayment, "id" | "status">>();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("training_request_payments")
      .update(existing.status === "paid" ? { training_session_id: session.id, updated_at: now } : payload)
      .eq("id", existing.id)
      .select("*")
      .single<TrainingRequestPayment>();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("training_request_payments")
    .insert({ ...payload, created_at: now })
    .select("*")
    .single<TrainingRequestPayment>();

  if (error) {
    throw error;
  }

  return data;
}

async function addSystemMessage({
  conversationId,
  body,
}: {
  conversationId: string | null | undefined;
  body: string;
}) {
  if (!conversationId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const retentionExpiresAt = new Date(nowDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_user_id: null,
    sender_role: "system",
    body,
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: now, retention_expires_at: retentionExpiresAt, updated_at: now })
    .eq("id", conversationId);
}

async function notifyConversationUsers({
  conversationId,
  actorUserId,
  type,
  title,
  body,
  actionUrl,
}: {
  conversationId: string | null | undefined;
  actorUserId?: string | null;
  type: Parameters<typeof createNotification>[0]["type"];
  title: string;
  body: string;
  actionUrl: string;
}) {
  if (!conversationId) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", actorUserId ?? "00000000-0000-0000-0000-000000000000");

  for (const participant of participants ?? []) {
    if (!participant.user_id) {
      continue;
    }

    await supabase.rpc("increment_participant_unread", {
      target_conversation_id: conversationId,
      target_user_id: participant.user_id,
    });

    await createNotification({
      userId: participant.user_id,
      type,
      title,
      body,
      relatedConversationId: conversationId,
      actionUrl,
    });

    await sendPushNotificationToUser(participant.user_id, {
      title,
      body,
      url: actionUrl,
      tag: `conversation-${conversationId}`,
    });
  }
}

export async function acceptTrainingRequest(formData: FormData) {
  const { coach, user } = await getCoachContextOrRedirect();
  const requestId = textValue(formData, "request_id");
  const conversationId = textValue(formData, "conversation_id");
  const returnPath = conversationId ? `/coach/messages/${conversationId}` : "/coach/messages";
  const request = await getTrainingRequestForCoach({ requestId, conversationId, coachId: coach.id });

  if (!request?.id || !request.conversation_id) {
    redirect(`${returnPath}?request_error=not-found`);
  }

  if (request.status !== "pending") {
    redirect(`${returnPath}?request_error=not-pending`);
  }

  const { serviceTitle, amountCents } = await getServicePriceCents({ request, coach });
  if (!amountCents) {
    redirect(`${returnPath}?request_error=missing-price`);
  }

  const amounts = calculatePaymentAmounts(amountCents);
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const session = await upsertFirstTrainingSession({
    request: { ...request, service_title: serviceTitle },
    coach,
    amounts,
  });
  await upsertFirstTrainingPayment({
    request: { ...request, service_title: serviceTitle },
    coach,
    session,
    amounts,
  });

  const { error } = await supabase
    .from("training_requests")
    .update({
      status: "accepted_pending_payment",
      payment_status: "requires_payment",
      payment_method: "platform",
      service_title: serviceTitle,
      gross_amount_cents: amounts.grossAmountCents,
      platform_fee_cents: amounts.platformFeeCents,
      coach_payout_cents: amounts.coachPayoutCents,
      currency: "usd",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("coach_id", coach.id)
    .eq("status", "pending");

  if (error) {
    throw error;
  }

  await supabase
    .from("conversations")
    .update({ status: "replied", is_unread_by_coach: false, updated_at: now })
    .eq("id", request.conversation_id)
    .eq("coach_id", coach.id);

  await addSystemMessage({
    conversationId: request.conversation_id,
    body: [
      `${coach.full_name} accepted this training request.`,
      `First session payment is required through Reppy to confirm your booking.`,
      `Service: ${serviceTitle}`,
      `Session price: ${formatMoney(amounts.grossAmountCents)}`,
    ].join("\n"),
  });
  await notifyConversationUsers({
    conversationId: request.conversation_id,
    actorUserId: user.id,
    type: "payment_required",
    title: "Training request accepted",
    body: "First session payment is required through Reppy to confirm your booking.",
    actionUrl: `/account/messages/${request.conversation_id}`,
  });

  revalidatePath("/coach/dashboard");
  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${request.conversation_id}`);
  redirect(`${returnPath}?request=accepted`);
}

export async function declineTrainingRequest(formData: FormData) {
  const { coach, user } = await getCoachContextOrRedirect();
  const requestId = textValue(formData, "request_id");
  const conversationId = textValue(formData, "conversation_id");
  const reason = textValue(formData, "decline_reason");
  const returnPath = conversationId ? `/coach/messages/${conversationId}` : "/coach/messages";
  const request = await getTrainingRequestForCoach({ requestId, conversationId, coachId: coach.id });

  if (!request?.id || !request.conversation_id) {
    redirect(`${returnPath}?request_error=not-found`);
  }

  if (!["pending", "accepted_pending_payment"].includes(request.status)) {
    redirect(`${returnPath}?request_error=not-actionable`);
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("training_requests")
    .update({
      status: "declined",
      payment_status: "not_required",
      declined_at: now,
      updated_at: now,
    })
    .eq("id", request.id)
    .eq("coach_id", coach.id);

  if (error) {
    throw error;
  }

  await supabase
    .from("training_sessions")
    .update({ status: "declined", payment_status: "not_required", updated_at: now })
    .eq("training_request_id", request.id)
    .neq("status", "paid_confirmed");

  await supabase
    .from("conversations")
    .update({ status: "declined", is_unread_by_coach: false, updated_at: now })
    .eq("id", request.conversation_id)
    .eq("coach_id", coach.id);

  await addSystemMessage({
    conversationId: request.conversation_id,
    body: [`${coach.full_name} declined this training request.`, reason ? `Note: ${reason}` : ""]
      .filter(Boolean)
      .join("\n"),
  });
  await notifyConversationUsers({
    conversationId: request.conversation_id,
    actorUserId: user.id,
    type: "request_declined",
    title: "Training request declined",
    body: reason || "The coach declined this request. You can message them or find another coach.",
    actionUrl: `/account/messages/${request.conversation_id}`,
  });

  revalidatePath("/coach/dashboard");
  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${request.conversation_id}`);
  redirect(`${returnPath}?request=declined`);
}

export async function createTrainingPaymentCheckout(formData: FormData) {
  const user = await getAccountUserOrRedirect();
  const paymentId = textValue(formData, "payment_id");
  const conversationId = textValue(formData, "conversation_id");
  const returnPath = conversationId ? `/account/messages/${conversationId}` : "/account/messages";

  if (!paymentId) {
    redirect(`${returnPath}?payment_error=missing-payment`);
  }

  if (!hasStripeCheckoutConfig()) {
    redirect(`${returnPath}?payment_error=missing-stripe-config`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: payment, error: paymentError } = await supabase
    .from("training_request_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("requester_user_id", user.id)
    .maybeSingle<TrainingRequestPayment>();

  if (paymentError) {
    throw paymentError;
  }

  if (!payment) {
    redirect(`${returnPath}?payment_error=not-found`);
  }

  if (payment.status === "paid") {
    redirect(`${returnPath}?payment=already-paid`);
  }

  if (payment.payment_method !== "platform") {
    redirect(`${returnPath}?payment_error=not-platform`);
  }

  if (payment.status === "checkout_created" && payment.checkout_url) {
    redirect(payment.checkout_url);
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("full_name, stripe_connected_account_id")
    .eq("id", payment.coach_id)
    .maybeSingle<Pick<Coach, "full_name" | "stripe_connected_account_id">>();

  let checkoutUrl = "";
  try {
    const session = await createStripeCheckoutSession({
      paymentId: payment.id,
      trainingRequestId: payment.training_request_id,
      trainingSessionId: payment.training_session_id,
      conversationId: payment.conversation_id,
      requesterUserId: payment.requester_user_id,
      requesterEmail: user.email ?? null,
      coachName: coach?.full_name ?? "Coach",
      serviceTitle: payment.service_title ?? "Training session",
      amountCents: payment.gross_amount_cents,
      platformFeeCents: payment.platform_fee_cents,
      currency: payment.currency,
      connectedAccountId: coach?.stripe_connected_account_id ?? null,
    });

    const now = new Date().toISOString();
    await supabase
      .from("training_request_payments")
      .update({
        status: "checkout_created",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.paymentIntentId,
        checkout_url: session.url,
        updated_at: now,
      })
      .eq("id", payment.id);

    if (payment.training_request_id) {
      await supabase
        .from("training_requests")
        .update({
          payment_status: "checkout_created",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.paymentIntentId,
          updated_at: now,
        })
        .eq("id", payment.training_request_id)
        .eq("requester_user_id", user.id);
    }

    if (payment.training_session_id) {
      await supabase
        .from("training_sessions")
        .update({ payment_status: "checkout_created", updated_at: now })
        .eq("id", payment.training_session_id)
        .eq("requester_user_id", user.id);
    }

    checkoutUrl = session.url;
  } catch (error) {
    console.error("[payments] Stripe checkout creation failed", {
      paymentId: payment.id,
      message: error instanceof Error ? error.message : String(error),
    });
    redirect(`${returnPath}?payment_error=checkout-failed`);
  }

  redirect(checkoutUrl);
}

export async function requestFutureTrainingSession(formData: FormData) {
  const user = await getAccountUserOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const requestId = textValue(formData, "request_id");
  const requestedDate = textValue(formData, "requested_date");
  const requestedStartTime = textValue(formData, "requested_start_time");
  const requestedEndTime = textValue(formData, "requested_end_time");
  const preferredDaysTimes = textValue(formData, "preferred_days_times");
  const location = textValue(formData, "location");
  const notes = textValue(formData, "notes");
  const returnPath = conversationId ? `/account/messages/${conversationId}` : "/account/messages";
  const supabase = createSupabaseAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("training_requests")
    .select("*")
    .eq("id", requestId)
    .eq("requester_user_id", user.id)
    .maybeSingle<TrainingRequest>();

  if (requestError) {
    throw requestError;
  }

  if (!request || !["paid_confirmed", "completed"].includes(request.status)) {
    redirect(`${returnPath}?session_error=first-session-required`);
  }

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("*")
    .eq("id", request.coach_id)
    .maybeSingle<Coach>();

  if (coachError) {
    throw coachError;
  }

  if (!coach) {
    redirect(`${returnPath}?session_error=coach-not-found`);
  }

  const requestedMethod = textValue(formData, "payment_method");
  const platformRequired = coach.platform_payment_required === true;
  const platformAllowed = coach.platform_payment_allowed !== false;
  const paymentMethod = platformRequired ? "platform" : requestedMethod === "platform" && platformAllowed ? "platform" : "coach_direct";
  const { serviceTitle, amountCents } = await getServicePriceCents({ request, coach });

  if (!amountCents) {
    redirect(`${returnPath}?session_error=missing-price`);
  }

  const amounts = paymentMethod === "platform"
    ? calculatePaymentAmounts(amountCents)
    : { grossAmountCents: amountCents, platformFeeCents: 0, coachPayoutCents: amountCents };
  const now = new Date().toISOString();
  const paymentStatus = paymentMethod === "platform" ? "requires_payment" : "coach_direct_pending";
  const sessionStatus = paymentMethod === "platform" ? "accepted_pending_payment" : "direct_payment_pending";
  const { data: session, error: sessionError } = await supabase
    .from("training_sessions")
    .insert({
      training_request_id: request.id,
      conversation_id: request.conversation_id,
      coach_id: coach.id,
      coach_user_id: coach.user_id,
      requester_user_id: user.id,
      service_id: request.service_id ?? null,
      service_title: serviceTitle,
      session_kind: "future_session",
      status: sessionStatus,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      requested_date: requestedDate || null,
      requested_start_time: requestedStartTime || null,
      requested_end_time: requestedEndTime || null,
      timezone: request.timezone ?? coach.timezone ?? "America/New_York",
      preferred_days_times: preferredDaysTimes || null,
      location: location || request.preferred_location || null,
      notes: notes || null,
      gross_amount_cents: amounts.grossAmountCents,
      platform_fee_cents: amounts.platformFeeCents,
      coach_payout_cents: amounts.coachPayoutCents,
      currency: "usd",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single<TrainingSession>();

  if (sessionError) {
    throw sessionError;
  }

  const { error: paymentError } = await supabase.from("training_request_payments").insert({
    training_request_id: request.id,
    training_session_id: session.id,
    conversation_id: request.conversation_id,
    coach_id: coach.id,
    coach_user_id: coach.user_id,
    requester_user_id: user.id,
    service_id: request.service_id ?? null,
    service_title: serviceTitle,
    session_kind: "future_session",
    payment_method: paymentMethod,
    status: paymentStatus,
    gross_amount_cents: amounts.grossAmountCents,
    platform_fee_cents: amounts.platformFeeCents,
    coach_payout_cents: amounts.coachPayoutCents,
    currency: "usd",
    requested_date: requestedDate || null,
    requested_start_time: requestedStartTime || null,
    requested_end_time: requestedEndTime || null,
    timezone: request.timezone ?? coach.timezone ?? "America/New_York",
    metadata: { source: "future_session_request" },
    created_at: now,
    updated_at: now,
  });

  if (paymentError) {
    throw paymentError;
  }

  await addSystemMessage({
    conversationId: request.conversation_id,
    body: [
      "A future session was requested.",
      `Service: ${serviceTitle}`,
      requestedDate ? `Requested date: ${requestedDate}` : "",
      requestedStartTime ? `Requested time: ${requestedStartTime}${requestedEndTime ? ` to ${requestedEndTime}` : ""}` : "",
      `Payment option: ${paymentMethod === "platform" ? "Pay through Reppy" : "Pay coach directly"}`,
      paymentMethod === "platform" ? "Reppy payment is required before this session is confirmed." : "The coach can mark direct payment received after collecting payment.",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  await notifyConversationUsers({
    conversationId: request.conversation_id,
    actorUserId: user.id,
    type: paymentMethod === "platform" ? "future_session_requested" : "direct_payment_selected",
    title: "Future session requested",
    body: paymentMethod === "platform" ? "A future session is waiting for Reppy payment." : "A future session was requested with direct coach payment.",
    actionUrl: `/coach/messages/${request.conversation_id}`,
  });

  revalidatePath("/account/dashboard");
  revalidatePath("/account/messages");
  revalidatePath(returnPath);
  redirect(`${returnPath}?session=requested`);
}

export async function markDirectPaymentReceived(formData: FormData) {
  const { coach, user } = await getCoachContextOrRedirect();
  const paymentId = textValue(formData, "payment_id");
  const conversationId = textValue(formData, "conversation_id");
  const returnPath = conversationId ? `/coach/messages/${conversationId}` : "/coach/messages";

  if (!paymentId) {
    redirect(`${returnPath}?payment_error=missing-payment`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: payment, error } = await supabase
    .from("training_request_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("coach_id", coach.id)
    .eq("payment_method", "coach_direct")
    .maybeSingle<TrainingRequestPayment>();

  if (error) {
    throw error;
  }

  if (!payment || payment.status !== "coach_direct_pending") {
    redirect(`${returnPath}?payment_error=not-actionable`);
  }

  const now = new Date().toISOString();
  await supabase
    .from("training_request_payments")
    .update({ status: "coach_marked_paid", paid_at: now, updated_at: now })
    .eq("id", payment.id)
    .eq("coach_id", coach.id);

  if (payment.training_session_id) {
    await supabase
      .from("training_sessions")
      .update({ status: "confirmed", payment_status: "coach_marked_paid", paid_at: now, updated_at: now })
      .eq("id", payment.training_session_id)
      .eq("coach_id", coach.id);
  }

  await addSystemMessage({
    conversationId: payment.conversation_id,
    body: `${coach.full_name} marked direct payment received for ${payment.service_title ?? "a future session"}.`,
  });
  await notifyConversationUsers({
    conversationId: payment.conversation_id,
    actorUserId: user.id,
    type: "direct_payment_received",
    title: "Direct payment marked received",
    body: "Your coach marked direct payment received for the session.",
    actionUrl: `/account/messages/${payment.conversation_id}`,
  });

  revalidatePath("/coach/messages");
  revalidatePath(returnPath);
  redirect(`${returnPath}?payment=direct-received`);
}

export async function updateConversationStatus(formData: FormData) {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const access = await getMessageAccess({ coach, coachUserId });

  if (!access.hasAccess) {
    redirect(`/coach/messages/${conversationId}`);
  }

  const status = textValue(formData, "status");
  const allowed = ["new", "replied", "scheduled", "completed", "declined", "archived", "spam"];

  if (!conversationId || !allowed.includes(status)) {
    throw new Error("Invalid conversation status update.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("coach_id", coach.id);

  if (error) {
    throw error;
  }

  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${conversationId}`);
}

export async function toggleConversationSaved(formData: FormData) {
  const { coach, coachUserId, user } = await getCoachContextOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const isSaved = textValue(formData, "is_saved") === "true";
  const access = await getMessageAccess({ coach, coachUserId });

  if (!access.hasAccess) {
    redirect(`/coach/messages/${conversationId}`);
  }

  if (!user.email_confirmed_at) {
    throw new Error("Verify your email before replying.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("conversations")
    .update({
      is_saved: isSaved,
      saved_at: isSaved ? new Date().toISOString() : null,
      saved_by_user_id: isSaved ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("coach_id", coach.id);

  if (error) {
    throw error;
  }

  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${conversationId}`);
}

export async function replyToConversation(formData: FormData) {
  const { coach, coachUserId, user } = await getCoachContextOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const body = textValue(formData, "body");
  const access = await getMessageAccess({ coach, coachUserId });

  if (!access.hasAccess) {
    redirect(`/coach/messages/${conversationId}`);
  }

  if (!conversationId || !body) {
    throw new Error("Missing reply content.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("coach_id", coach.id)
    .maybeSingle<{ id: string }>();

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const retentionExpiresAt = new Date(nowDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_user_id: user.id,
    sender_role: "coach",
    body,
  });

  if (messageError) {
    throw messageError;
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      status: "replied",
      is_unread_by_coach: false,
      last_message_at: now,
      retention_expires_at: retentionExpiresAt,
      updated_at: now,
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  await supabase
    .from("conversation_participants")
    .update({ unread_count: 0, last_read_at: now, updated_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  const { data: recipients } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id)
    .eq("is_blocked", false);

  for (const recipient of recipients ?? []) {
    if (!recipient.user_id) {
      continue;
    }

    await supabase.rpc("increment_participant_unread", {
      target_conversation_id: conversationId,
      target_user_id: recipient.user_id,
    });

    await supabase.from("notifications").insert({
      user_id: recipient.user_id,
      type: "coach_replied",
      title: "Your coach replied",
      body: "Open Reppy to view the reply.",
      related_conversation_id: conversationId,
      action_url: `/account/messages/${conversationId}`,
      is_read: false,
    });

    await sendPushNotificationToUser(recipient.user_id, {
      title: "Your coach replied",
      body: "Open Reppy to view the reply.",
      url: `/account/messages/${conversationId}`,
      tag: `conversation-${conversationId}`,
    });
  }

  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${conversationId}`);
}

export async function replyToConversationAsAccount(formData: FormData) {
  const user = await getAccountUserOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const body = textValue(formData, "body");

  if (!conversationId || !body) {
    throw new Error("Missing reply content.");
  }

  if (!user.email_confirmed_at) {
    throw new Error("Verify your email before replying.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .neq("role", "coach")
    .maybeSingle<{ conversation_id: string }>();

  if (!participant) {
    throw new Error("Conversation not found.");
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const retentionExpiresAt = new Date(nowDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_user_id: user.id,
    sender_role: "parent",
    body,
  });

  if (messageError) {
    throw messageError;
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      retention_expires_at: retentionExpiresAt,
      updated_at: now,
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  await supabase
    .from("conversation_participants")
    .update({ unread_count: 0, last_read_at: now, updated_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  const { data: recipients } = await supabase
    .from("conversation_participants")
    .select("user_id, role")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id)
    .eq("is_blocked", false);

  for (const recipient of recipients ?? []) {
    if (!recipient.user_id) {
      continue;
    }

    await supabase.rpc("increment_participant_unread", {
      target_conversation_id: conversationId,
      target_user_id: recipient.user_id,
    });

    const actionUrl = recipient.role === "coach" ? `/coach/messages/${conversationId}` : `/account/messages/${conversationId}`;
    await supabase.from("notifications").insert({
      user_id: recipient.user_id,
      type: "new_message",
      title: "New message in Reppy",
      body: "Open your Message Center to view it.",
      related_conversation_id: conversationId,
      action_url: actionUrl,
      is_read: false,
    });

    await sendPushNotificationToUser(recipient.user_id, {
      title: "New message in Reppy",
      body: "Open your Message Center to view it.",
      url: actionUrl,
      tag: `conversation-${conversationId}`,
    });
  }

  revalidatePath("/account/messages");
  revalidatePath(`/account/messages/${conversationId}`);
}

export async function markNotificationRead(formData: FormData) {
  const user = await getAuthenticatedUserOrRedirect();
  const notificationId = textValue(formData, "notification_id");

  if (!notificationId) {
    throw new Error("Missing notification id.");
  }

  await markNotificationReadForUser({ notificationId, userId: user.id });
  revalidatePath("/coach/notifications");
  revalidatePath("/account/notifications");
}

export async function markAllNotificationsRead() {
  const user = await getAuthenticatedUserOrRedirect();
  await markAllNotificationsReadForUser(user.id);
  revalidatePath("/coach/notifications");
  revalidatePath("/account/notifications");
}

export async function dismissNotification(formData: FormData) {
  const user = await getAuthenticatedUserOrRedirect();
  const notificationId = textValue(formData, "notification_id");

  if (!notificationId) {
    throw new Error("Missing notification id.");
  }

  await deleteNotificationForUser({ notificationId, userId: user.id });
  revalidatePath("/coach/notifications");
  revalidatePath("/account/notifications");
}

export async function addConversationToPlayers(formData: FormData) {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const conversationId = textValue(formData, "conversation_id");
  const access = await getMessageAccess({ coach, coachUserId });

  if (!access.hasAccess) {
    redirect("/coach/players");
  }

  const supabase = createSupabaseAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, sport, status")
    .eq("id", conversationId)
    .eq("coach_id", coach.id)
    .maybeSingle<{ id: string; sport: string | null; status: string }>();

  const { data: details } = await supabase
    .from("conversation_private_details")
    .select("requester_display_name, current_level")
    .eq("conversation_id", conversationId)
    .maybeSingle<{ requester_display_name: string | null; current_level: string | null }>();

  if (!conversation || !["scheduled", "completed"].includes(conversation.status)) {
    throw new Error("A conversation must be scheduled or completed before adding a player record.");
  }

  const { error } = await supabase.from("player_records").insert({
    coach_user_id: coachUserId,
    coach_id: coach.id,
    source_conversation_id: conversationId,
    display_name: details?.requester_display_name || "Player",
    sport: conversation.sport,
    current_level: details?.current_level ?? null,
    status: conversation.status === "completed" ? "completed" : "prospective",
    guardian_involved: true,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/coach/players");
  redirect("/coach/players");
}

async function getOwnedCoachForUser(userId: string, email?: string | null) {
  const supabase = createSupabaseAdminClient();
  const { data: owned, error: ownedError } = await supabase
    .from("coaches")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<Coach>();

  if (ownedError) {
    throw ownedError;
  }

  if (owned) {
    return owned;
  }

  if (!email) {
    return null;
  }

  const { data: matched, error: matchedError } = await supabase
    .from("coaches")
    .select("*")
    .eq("email", email)
    .is("user_id", null)
    .limit(1)
    .maybeSingle<Coach>();

  if (matchedError) {
    throw matchedError;
  }

  if (matched) {
    const { data: linked, error: linkError } = await supabase
      .from("coaches")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", matched.id)
      .select("*")
      .single<Coach>();

    if (linkError) {
      throw linkError;
    }

    return linked;
  }

  return null;
}

export async function saveCoachProfile(formData: FormData) {
  const { user, profile } = await getCoachUserOrRedirect();
  const supabase = createSupabaseAdminClient();
  const returnTo = safeReturnPath(textValue(formData, "return_to") || "/coach/profile/edit");
  const intent = textValue(formData, "intent") === "submit" ? "submit" : "draft";

  const fullName = textValue(formData, "full_name") || profile.display_name || user.email || "Coach";
  const slug = slugify(textValue(formData, "slug") || fullName);
  const sport = textValue(formData, "sport");
  const location = textValue(formData, "location");
  const zipCode = textValue(formData, "zip_code");

  if (!fullName || !slug || !sport) {
    redirect(`${returnTo}?error=missing-required`);
  }

  if (!location && !zipCode) {
    redirect(`${returnTo}?error=missing-location`);
  }

  let coach = await getOwnedCoachForUser(user.id, user.email);
  const { data: duplicateSlug, error: slugError } = await supabase
    .from("coaches")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();

  if (slugError) {
    throw slugError;
  }

  if (duplicateSlug && duplicateSlug.id !== coach?.id) {
    redirect(`${returnTo}?error=slug-taken`);
  }

  if (!coach) {
    const { data: created, error: createError } = await supabase
      .from("coaches")
      .insert({
        user_id: user.id,
        full_name: fullName,
        slug,
        email: user.email ?? null,
        sport,
        pricing_text: "Pricing available upon request.",
        profile_status: "draft",
        is_published: false,
        accepting_requests: false,
      })
      .select("*")
      .single<Coach>();

    if (createError) {
      throw createError;
    }

    coach = created;
  }

  const serviceTitles = arrayTextValues(formData, "service_title");
  const serviceDescriptions = arrayTextValues(formData, "service_description");
  const serviceDurations = arrayTextValues(formData, "service_duration");
  const servicePrices = arrayTextValues(formData, "service_price");
  const serviceFormats = arrayTextValues(formData, "service_format");
  const serviceLevels = arrayTextValues(formData, "service_level");
  const services = serviceTitles
    .map((title, index) => ({
      coach_id: coach.id,
      title,
      description: serviceDescriptions[index] || null,
      duration: serviceDurations[index] || null,
      price: servicePrices[index] || null,
      format: serviceFormats[index] || null,
      level: serviceLevels[index] || null,
      is_featured: index === 0,
      sort_order: index + 1,
    }))
    .filter((service) => service.title);

  const credentialTitles = arrayTextValues(formData, "credential_title");
  const credentialOrganizations = arrayTextValues(formData, "credential_organization");
  const credentialYears = arrayTextValues(formData, "credential_year");
  const credentialDescriptions = arrayTextValues(formData, "credential_description");
  const credentials = credentialTitles
    .map((title, index) => ({
      coach_id: coach.id,
      title,
      organization: credentialOrganizations[index] || null,
      year: optionalInteger(credentialYears[index] || ""),
      description: credentialDescriptions[index] || null,
      sort_order: index + 1,
      is_verified: false,
    }))
    .filter((credential) => credential.title);

  const audienceLabels = arrayTextValues(formData, "audience_label")
    .filter(Boolean)
    .map((label, index) => ({
      coach_id: coach.id,
      label,
      sort_order: index + 1,
    }));

  const uploadedProfilePhotoUrl = await uploadCoachImage({
    coachId: coach.id,
    file: fileValue(formData, "profile_photo_file"),
    folder: "profile",
  });
  const uploadedBannerImageUrl = await uploadCoachImage({
    coachId: coach.id,
    file: fileValue(formData, "banner_image_file"),
    folder: "cover",
  });

  const publicTextValues = [
    textValue(formData, "headline"),
    textValue(formData, "bio"),
    textValue(formData, "playing_experience"),
    textValue(formData, "coaching_experience"),
    textValue(formData, "training_approach"),
    textValue(formData, "service_area"),
    textValue(formData, "pricing_text"),
    ...serviceDescriptions,
  ];
  const hasContactInfo = scanForPublicContactInfo(publicTextValues);
  const blockedSubmit = intent === "submit" && hasContactInfo;
  const currentStatus = coach.profile_status ?? "draft";
  const nextStatus: CoachProfileStatus = blockedSubmit
    ? "draft"
    : intent === "submit"
      ? "pending_review"
      : currentStatus;
  const resolvedLocation = resolveCoachLocationFields({
    location,
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    zipCode,
  });
  const serviceRadiusMiles = optionalInteger(textValue(formData, "service_radius_miles")) ?? coach.service_radius_miles ?? 30;
  const profilePayload: Partial<Coach> = {
    full_name: fullName,
    slug,
    email: user.email ?? coach.email ?? null,
    sport,
    category: textValue(formData, "category") || null,
    headline: textValue(formData, "headline") || null,
    bio: textValue(formData, "bio") || null,
    playing_experience: textValue(formData, "playing_experience") || null,
    coaching_experience: textValue(formData, "coaching_experience") || null,
    current_affiliation: textValue(formData, "current_affiliation") || null,
    years_experience: optionalInteger(textValue(formData, "years_experience")),
    training_approach: textValue(formData, "training_approach") || null,
    age_groups: textValue(formData, "age_groups") || null,
    skill_levels: textValue(formData, "skill_levels") || null,
    positions: textValue(formData, "positions") || null,
    training_format: textValue(formData, "training_format") || null,
    general_availability: textValue(formData, "general_availability") || null,
    location: location || zipCode || null,
    public_location: resolvedLocation.public_location,
    city: resolvedLocation.city,
    state: resolvedLocation.state,
    zip_code: resolvedLocation.zip_code,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
    timezone: textValue(formData, "timezone") || coach.timezone || "America/New_York",
    service_radius_miles: Math.max(1, Math.min(100, serviceRadiusMiles)),
    service_area: textValue(formData, "service_area") || null,
    pricing_text: textValue(formData, "pricing_text") || "Pricing available upon request.",
    profile_photo_url: uploadedProfilePhotoUrl || textValue(formData, "profile_photo_url") || coach.profile_photo_url || null,
    banner_image_url: uploadedBannerImageUrl || textValue(formData, "banner_image_url") || coach.banner_image_url || null,
    instagram_url: textValue(formData, "instagram_url") || null,
    video_url: textValue(formData, "video_url") || null,
    booking_url: textValue(formData, "booking_url") || null,
    accepting_requests: formData.get("accepting_requests") === "on",
    coach_direct_preferred: formData.get("coach_direct_preferred") === "on",
    platform_payment_allowed:
      formData.get("platform_payment_required") === "on" || formData.get("platform_payment_allowed") === "on",
    platform_payment_required: formData.get("platform_payment_required") === "on",
    profile_status: nextStatus,
    is_published: currentStatus === "published" && intent !== "submit" ? coach.is_published : false,
    contact_scan_status: hasContactInfo ? "flagged" : "clear",
    onboarding_step: intent === "submit" && !blockedSubmit ? 5 : coach.onboarding_step ?? 1,
    onboarding_completed_at: intent === "submit" && !blockedSubmit ? new Date().toISOString() : coach.onboarding_completed_at ?? null,
    submitted_at: intent === "submit" && !blockedSubmit ? new Date().toISOString() : coach.submitted_at ?? null,
    updated_at: new Date().toISOString(),
  };
  profilePayload.profile_completion = calculateProfileCompletion({
    coach: profilePayload,
    servicesCount: services.length,
    credentialsCount: credentials.length,
  });

  let { error: updateError } = await supabase.from("coaches").update(profilePayload).eq("id", coach.id);

  if (updateError && isMissingCoachLocationColumnError(updateError)) {
    const legacyPayload = { ...profilePayload };
    delete legacyPayload.city;
    delete legacyPayload.state;
    delete legacyPayload.zip_code;
    delete legacyPayload.latitude;
    delete legacyPayload.longitude;
    delete legacyPayload.public_location;
    delete legacyPayload.service_radius_miles;
    delete legacyPayload.timezone;
    const fallback = await supabase.from("coaches").update(legacyPayload).eq("id", coach.id);
    updateError = fallback.error;
  }

  if (updateError) {
    throw updateError;
  }

  const { error: deleteServicesError } = await supabase.from("coach_services").delete().eq("coach_id", coach.id);
  if (deleteServicesError) {
    throw deleteServicesError;
  }

  if (services.length) {
    const { error: insertServicesError } = await supabase.from("coach_services").insert(services);
    if (insertServicesError) {
      throw insertServicesError;
    }
  }

  const { error: deleteCredentialsError } = await supabase.from("coach_credentials").delete().eq("coach_id", coach.id);
  if (deleteCredentialsError) {
    throw deleteCredentialsError;
  }

  if (credentials.length) {
    const { error: insertCredentialsError } = await supabase.from("coach_credentials").insert(credentials);
    if (insertCredentialsError) {
      throw insertCredentialsError;
    }
  }

  const { error: deleteAudienceError } = await supabase.from("coach_audiences").delete().eq("coach_id", coach.id);
  if (deleteAudienceError) {
    throw deleteAudienceError;
  }

  if (audienceLabels.length) {
    const { error: insertAudienceError } = await supabase.from("coach_audiences").insert(audienceLabels);
    if (insertAudienceError) {
      throw insertAudienceError;
    }
  }

  revalidatePath("/");
  revalidatePath("/coaches");
  revalidatePath(`/coaches/${slug}`);
  revalidatePath("/coach/dashboard");
  revalidatePath("/coach/profile");
  revalidatePath("/coach/profile/edit");
  revalidatePath("/coach/profile/preview");
  revalidatePath("/coach/onboarding");

  if (blockedSubmit) {
    redirect(`${returnTo}?error=public-contact`);
  }

  redirect(`${returnTo}?${intent === "submit" ? "submitted=1" : "saved=1"}`);
}

export async function saveCoachAvailabilityBlock(formData: FormData) {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const supabase = createSupabaseAdminClient();
  const blockId = textValue(formData, "block_id");
  const availabilityDate = textValue(formData, "availability_date");
  const startTime = textValue(formData, "start_time");
  const endTime = textValue(formData, "end_time");
  const note = textValue(formData, "note");
  const timezone = textValue(formData, "timezone") || "America/New_York";
  const returnTo = safeCoachReturnPath(textValue(formData, "return_to"), "/coach/calendar");
  const redirectDate = validIsoDate(availabilityDate) ? availabilityDate : "";
  const redirectPath = `${returnTo.split("?")[0]}${redirectDate ? `?date=${encodeURIComponent(redirectDate)}` : ""}`;

  if (!validIsoDate(availabilityDate) || !validTime(startTime) || !validTime(endTime)) {
    redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=invalid-time`);
  }

  if (endTime <= startTime) {
    redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=end-before-start`);
  }

  const payload = {
    coach_id: coach.id,
    coach_user_id: coachUserId ?? user.id,
    availability_date: availabilityDate,
    start_time: startTime,
    end_time: endTime,
    timezone,
    note: note || null,
    updated_at: new Date().toISOString(),
  };

  if (blockId) {
    const { error } = await supabase
      .from("coach_availability_blocks")
      .update(payload)
      .eq("id", blockId)
      .eq("coach_id", coach.id);

    if (error) {
      console.error("[coach availability] update failed", {
        coachId: coach.id,
        blockId,
        message: error.message,
        code: error.code,
      });
      redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=save-failed`);
    }
  } else {
    const { error } = await supabase.from("coach_availability_blocks").insert({
      ...payload,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[coach availability] insert failed", {
        coachId: coach.id,
        message: error.message,
        code: error.code,
      });
      redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=save-failed`);
    }
  }

  revalidatePath("/coach/calendar");
  revalidatePath("/coach/dashboard");
  revalidatePath("/coach/profile");
  revalidatePath(`/coaches/${coach.slug}`);
  redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}saved=1`);
}

export async function deleteCoachAvailabilityBlock(formData: FormData) {
  const { coach } = await getCoachContextOrRedirect();
  const supabase = createSupabaseAdminClient();
  const blockId = textValue(formData, "block_id");
  const availabilityDate = textValue(formData, "availability_date");
  const returnTo = safeCoachReturnPath(textValue(formData, "return_to"), "/coach/calendar");
  const redirectDate = validIsoDate(availabilityDate) ? availabilityDate : "";
  const redirectPath = `${returnTo.split("?")[0]}${redirectDate ? `?date=${encodeURIComponent(redirectDate)}` : ""}`;

  if (!blockId) {
    redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=missing-block`);
  }

  const { error } = await supabase
    .from("coach_availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("coach_id", coach.id);

  if (error) {
    console.error("[coach availability] delete failed", {
      coachId: coach.id,
      blockId,
      message: error.message,
      code: error.code,
    });
    redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}error=delete-failed`);
  }

  revalidatePath("/coach/calendar");
  revalidatePath("/coach/dashboard");
  revalidatePath("/coach/profile");
  revalidatePath(`/coaches/${coach.slug}`);
  redirect(`${redirectPath}${redirectPath.includes("?") ? "&" : "?"}deleted=1`);
}

export async function updateAccountProfile(formData: FormData) {
  const { user, profile } = await getAccountContextOrRedirect();
  const playerName = textValue(formData, "player_name");
  const guardianName = textValue(formData, "guardian_name");
  const playerDateOfBirth = textValue(formData, "player_date_of_birth");
  const currentTeam = textValue(formData, "current_team");

  if (!playerName) {
    redirect("/account/settings?error=missing-name");
  }

  if (profile.role === "parent" && !guardianName) {
    redirect("/account/settings?error=missing-guardian");
  }

  if (!playerDateOfBirth || !currentTeam) {
    redirect("/account/settings?error=missing-player-profile");
  }

  if (!isReasonablePlayerDateOfBirth(playerDateOfBirth)) {
    redirect("/account/settings?error=invalid-dob");
  }

  const supabase = createSupabaseAdminClient();
  const playerAgeAtSave = calculateAgeFromDateOfBirth(playerDateOfBirth);
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ display_name: playerName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  const { error: preferenceError } = await supabase.from("user_coaching_preferences").upsert(
    {
      user_id: user.id,
      player_name: playerName,
      guardian_name: guardianName || null,
      player_age: playerAgeAtSave === null ? null : String(playerAgeAtSave),
      player_birth_date: playerDateOfBirth,
      current_team: currentTeam,
      location_text: textValue(formData, "location_text") || null,
      skill_level: textValue(formData, "skill_level") || null,
      position: textValue(formData, "position") || null,
      training_goals: textValue(formData, "training_goals") || null,
      preferred_days: textValue(formData, "preferred_days") || null,
      contact_notes: textValue(formData, "contact_notes") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (preferenceError) {
    console.error("[updateAccountProfile] Failed to save player profile", {
      userId: user.id,
      error: preferenceError.message,
      code: preferenceError.code,
    });
    redirect("/account/settings?error=profile-save-failed");
  }

  const { error: privateDetailsError } = await supabase.from("account_private_details").upsert(
    {
      user_id: user.id,
      player_date_of_birth: playerDateOfBirth,
      account_type: profile.role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (privateDetailsError) {
    console.error("[updateAccountProfile] Failed to save private player DOB", {
      userId: user.id,
      error: privateDetailsError.message,
      code: privateDetailsError.code,
    });
    redirect("/account/settings?error=profile-save-failed");
  }

  revalidatePath("/account/dashboard");
  revalidatePath("/account/settings");
  redirect("/account/settings?saved=1");
}

export async function saveAccountPreferences(formData: FormData) {
  const { user } = await getAccountContextOrRedirect();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_coaching_preferences").upsert(
    {
      user_id: user.id,
      sport: textValue(formData, "sport") || null,
      location_text: textValue(formData, "location_text") || null,
      search_radius_miles: optionalInteger(textValue(formData, "search_radius_miles")),
      age_group: textValue(formData, "age_group") || null,
      skill_level: textValue(formData, "skill_level") || null,
      position: textValue(formData, "position") || null,
      training_goals: textValue(formData, "training_goals") || null,
      price_min: optionalInteger(textValue(formData, "price_min")),
      price_max: optionalInteger(textValue(formData, "price_max")),
      training_format: textValue(formData, "training_format") || null,
      preferred_days: textValue(formData, "preferred_days") || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  revalidatePath("/account/preferences");
  revalidatePath("/account/dashboard");
  redirect("/account/preferences?saved=1");
}

export async function toggleSavedCoach(formData: FormData) {
  const { user } = await getAccountContextOrRedirect();
  const coachId = textValue(formData, "coach_id");
  const coachSlug = slugify(textValue(formData, "coach_slug"));
  const wasSaved = textValue(formData, "saved") === "1";

  if (!coachId || !coachSlug) {
    redirect("/coaches");
  }

  const supabase = createSupabaseAdminClient();

  if (wasSaved) {
    const { error } = await supabase
      .from("saved_coaches")
      .delete()
      .eq("user_id", user.id)
      .eq("coach_id", coachId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("saved_coaches").upsert(
      {
        user_id: user.id,
        coach_id: coachId,
      },
      { onConflict: "user_id,coach_id" },
    );

    if (error) {
      throw error;
    }
  }

  revalidatePath("/account/dashboard");
  revalidatePath(`/coaches/${coachSlug}`);
  redirect(`/coaches/${coachSlug}${wasSaved ? "?unsaved=1" : "?saved=1"}`);
}

export async function createPremiumAccessGrant(formData: FormData) {
  const adminUser = await requireAdmin();
  const coachId = textValue(formData, "coach_id");
  const grantType = textValue(formData, "grant_type") || "manual";
  const endsAt = textValue(formData, "ends_at") || null;
  const notes = textValue(formData, "notes") || null;

  if (!coachId) {
    redirect("/admin/subscriptions?error=missing-coach");
  }

  const supabase = createSupabaseAdminClient();
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, user_id")
    .eq("id", coachId)
    .maybeSingle<{ id: string; user_id: string | null }>();

  if (coachError) {
    throw coachError;
  }

  if (!coach?.user_id) {
    redirect("/admin/subscriptions?error=missing-coach-user");
  }

  const { error } = await supabase.from("premium_access_grants").insert({
    coach_id: coach.id,
    user_id: coach.user_id,
    coach_user_id: coach.user_id,
    grant_type: grantType,
    starts_at: new Date().toISOString(),
    ends_at: endsAt,
    granted_by: adminUser.id,
    is_active: true,
    notes,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin/subscriptions");
  redirect("/admin/subscriptions?grant=created");
}

export async function deactivatePremiumAccessGrant(formData: FormData) {
  await requireAdmin();
  const grantId = textValue(formData, "grant_id");

  if (!grantId) {
    redirect("/admin/subscriptions?error=missing-grant");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("premium_access_grants")
    .update({ is_active: false })
    .eq("id", grantId);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/subscriptions");
  redirect("/admin/subscriptions?grant=deactivated");
}

export async function updateRequestStatus(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") as TrainingRequest["status"];

  if (
    !id ||
    ![
      "pending",
      "accepted_pending_payment",
      "paid_confirmed",
      "declined",
      "cancelled",
      "completed",
      "refunded",
    ].includes(status)
  ) {
    throw new Error("Invalid request status update.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("training_requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

export async function deleteTrainingRequest(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Missing request id.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("training_requests").delete().eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

export async function updateCoachApplicationStatus(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") as CoachApplication["status"];

  if (!id || !["new", "reviewing", "approved", "closed"].includes(status)) {
    throw new Error("Invalid coach application status update.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("coach_applications").update({ status }).eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/coach-applications");
  revalidatePath("/admin");
}

export async function updateCoachApprovalStatus(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");
  const decision = textValue(formData, "decision");
  const reviewNotes = textValue(formData, "review_notes") || null;

  if (!id || !["approved", "changes_requested", "rejected", "suspended"].includes(decision)) {
    throw new Error("Invalid coach approval update.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id, slug, user_id")
    .eq("id", id)
    .maybeSingle<{ id: string; slug: string; user_id: string | null }>();

  if (coachError) {
    throw coachError;
  }

  if (!coach) {
    throw new Error("Coach profile not found.");
  }

  const now = new Date().toISOString();
  const updates =
    decision === "approved"
      ? {
          profile_status: "published",
          is_published: true,
          accepting_requests: true,
          reviewed_at: now,
          review_notes: reviewNotes,
          updated_at: now,
        }
      : {
          profile_status: decision,
          is_published: false,
          reviewed_at: now,
          review_notes: reviewNotes,
          updated_at: now,
        };

  const { error } = await supabase.from("coaches").update(updates).eq("id", id);

  if (error) {
    throw error;
  }

  await createNotification({
    userId: coach.user_id,
    type: decision === "approved" ? "profile_approved" : "profile_changes_requested",
    title: decision === "approved" ? "Your Reppy profile is live" : "Coach profile update",
    body:
      decision === "approved"
        ? "Your profile is published and can receive training requests."
        : reviewNotes || "Review the requested changes before resubmitting your coach profile.",
    actionUrl: decision === "approved" ? `/coaches/${coach.slug}` : "/coach/profile/edit",
  });

  revalidatePath("/");
  revalidatePath("/coaches");
  revalidatePath(`/coaches/${coach.slug}`);
  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${id}`);
  redirect(`/admin/coaches/${id}?updated=1`);
}

export async function updateCoach(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Missing coach id.");
  }

  const supabase = createSupabaseAdminClient();
  const slug = textValue(formData, "slug");
  const serviceDescriptionsForScan = formData.getAll("service_description").map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  const hasContactInfo = scanForPublicContactInfo([
    textValue(formData, "headline"),
    textValue(formData, "bio"),
    textValue(formData, "service_area"),
    textValue(formData, "pricing_text"),
    ...serviceDescriptionsForScan,
  ]);
  const uploadedProfilePhotoUrl = await uploadCoachImage({
    coachId: id,
    file: fileValue(formData, "profile_photo_file"),
    folder: "profile",
  });
  const uploadedBannerImageUrl = await uploadCoachImage({
    coachId: id,
    file: fileValue(formData, "banner_image_file"),
    folder: "cover",
  });
  const location = textValue(formData, "location");
  const zipCode = textValue(formData, "zip_code");
  const resolvedLocation = resolveCoachLocationFields({
    location,
    city: textValue(formData, "city"),
    state: textValue(formData, "state"),
    zipCode,
  });
  const serviceRadiusMiles = optionalInteger(textValue(formData, "service_radius_miles")) ?? 30;
  const coachPayload: Partial<Coach> = {
      full_name: textValue(formData, "full_name"),
      slug,
      email: textValue(formData, "email") || null,
      phone: textValue(formData, "phone") || null,
      sport: textValue(formData, "sport") || null,
      category: textValue(formData, "category") || null,
      headline: textValue(formData, "headline") || null,
      bio: textValue(formData, "bio") || null,
      location: location || zipCode || null,
      public_location: resolvedLocation.public_location,
      city: resolvedLocation.city,
      state: resolvedLocation.state,
      zip_code: resolvedLocation.zip_code,
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      service_radius_miles: Math.max(1, Math.min(100, serviceRadiusMiles)),
      service_area: textValue(formData, "service_area") || null,
      pricing_text: textValue(formData, "pricing_text") || "Pricing available upon request.",
      profile_photo_url: uploadedProfilePhotoUrl || textValue(formData, "profile_photo_url") || null,
      banner_image_url: uploadedBannerImageUrl || textValue(formData, "banner_image_url") || null,
      instagram_url: textValue(formData, "instagram_url") || null,
      video_url: textValue(formData, "video_url") || null,
      booking_url: textValue(formData, "booking_url") || null,
      is_published: formData.get("is_published") === "on",
      is_featured: formData.get("is_featured") === "on",
      accepting_requests: formData.get("accepting_requests") === "on",
      coach_direct_preferred: formData.get("coach_direct_preferred") === "on",
      platform_payment_allowed:
        formData.get("platform_payment_required") === "on" || formData.get("platform_payment_allowed") === "on",
      platform_payment_required: formData.get("platform_payment_required") === "on",
      stripe_connected_account_id: textValue(formData, "stripe_connected_account_id") || null,
      founding_price_locked: formData.get("founding_price_locked") === "on",
      contact_scan_status: hasContactInfo ? "flagged" : "clear",
      admin_premium_access_until: textValue(formData, "admin_premium_access_until") || null,
      updated_at: new Date().toISOString(),
    };

  let { error } = await supabase.from("coaches").update(coachPayload).eq("id", id);

  if (error && isMissingCoachLocationColumnError(error)) {
    const legacyPayload = { ...coachPayload };
    delete legacyPayload.city;
    delete legacyPayload.state;
    delete legacyPayload.zip_code;
    delete legacyPayload.latitude;
    delete legacyPayload.longitude;
    delete legacyPayload.public_location;
    delete legacyPayload.service_radius_miles;
    const fallback = await supabase.from("coaches").update(legacyPayload).eq("id", id);
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  const serviceTitles = formData.getAll("service_title").map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  const serviceDescriptions = formData.getAll("service_description").map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  const serviceDurations = formData.getAll("service_duration").map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  const servicePrices = formData.getAll("service_price").map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  const services = serviceTitles
    .map((title, index) => ({
      coach_id: id,
      title,
      description: serviceDescriptions[index] || null,
      duration: serviceDurations[index] || null,
      price: servicePrices[index] || null,
      sort_order: index + 1,
    }))
    .filter((service) => service.title);

  const { error: deleteServicesError } = await supabase
    .from("coach_services")
    .delete()
    .eq("coach_id", id);

  if (deleteServicesError) {
    throw deleteServicesError;
  }

  if (services.length) {
    const { error: insertServicesError } = await supabase.from("coach_services").insert(services);

    if (insertServicesError) {
      throw insertServicesError;
    }
  }

  revalidatePath("/");
  revalidatePath("/coaches");
  revalidatePath(`/coaches/${slug}`);
  revalidatePath("/admin/coaches");
  redirect("/admin/coaches");
}
