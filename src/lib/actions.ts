"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAccountContextOrRedirect,
  getAccountPrivateDetails,
  getAccountUserOrRedirect,
  getApplicationProfile,
  getAuthenticatedUserOrRedirect,
  getCoachContextOrRedirect,
  getCoachUserOrRedirect,
} from "./auth";
import { getMessageAccess, startCoachTrial } from "./entitlements";
import { isMissingCoachLocationColumnError, resolveCoachLocationFields } from "./location";
import {
  createNotification,
  deleteNotificationForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "./notifications";
import { scanForPublicContactInfo } from "./profileModeration";
import { sendPushNotificationToUser } from "./push";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase";
import type { Coach, CoachApplication, CoachProfileStatus, TrainingRequest } from "./types";

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

function safeAccountNext(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/account/dashboard";
  }

  return value;
}

function safeLoginPath(value: string, fallback: string) {
  return value === "/account/login" || value === "/coach/login" ? value : fallback;
}

function optionalInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  const loginPath = safeLoginPath(textValue(formData, "login_path"), "/coach/login");

  if (!email || !password) {
    redirect(`${loginPath}?error=missing-fields`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`${loginPath}?error=invalid-login`);
  }

  const profile = await getApplicationProfile(data.user.id);

  if (!profile || profile.role !== "coach" || profile.account_status !== "active") {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=wrong-role`);
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=verify-email`);
  }

  redirect("/coach/dashboard");
}

export async function signOutCoach() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/coach/login");
}

export async function signOutAccount() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/account/login");
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

  const profile = await getApplicationProfile(data.user.id);

  if (!profile || !["parent", "adult_player"].includes(profile.role) || profile.account_status !== "active") {
    await supabase.auth.signOut();
    redirect("/account/login?error=wrong-role");
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    redirect("/account/login?error=verify-email");
  }

  const privateDetails = await getAccountPrivateDetails(data.user.id);
  const phoneVerified = privateDetails?.phone_verified_at || profile.phone_verified_at || data.user.phone_confirmed_at;

  if (!phoneVerified && next !== "/account/dashboard") {
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
    city: resolvedLocation.city,
    state: resolvedLocation.state,
    zip_code: resolvedLocation.zip_code,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
    service_area: textValue(formData, "service_area") || null,
    pricing_text: textValue(formData, "pricing_text") || "Pricing available upon request.",
    profile_photo_url: uploadedProfilePhotoUrl || textValue(formData, "profile_photo_url") || coach.profile_photo_url || null,
    banner_image_url: uploadedBannerImageUrl || textValue(formData, "banner_image_url") || coach.banner_image_url || null,
    instagram_url: textValue(formData, "instagram_url") || null,
    video_url: textValue(formData, "video_url") || null,
    booking_url: textValue(formData, "booking_url") || null,
    accepting_requests: formData.get("accepting_requests") === "on",
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

export async function updateAccountProfile(formData: FormData) {
  const { user } = await getAccountContextOrRedirect();
  const displayName = textValue(formData, "display_name");

  if (!displayName) {
    redirect("/account/settings?error=missing-name");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    throw error;
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

export async function updateRequestStatus(formData: FormData) {
  await requireAdmin();
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") as TrainingRequest["status"];

  if (!id || !["new", "contacted", "scheduled", "closed"].includes(status)) {
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
  const { error } = await supabase
    .from("coaches")
    .update({
      full_name: textValue(formData, "full_name"),
      slug,
      email: textValue(formData, "email") || null,
      phone: textValue(formData, "phone") || null,
      sport: textValue(formData, "sport") || null,
      category: textValue(formData, "category") || null,
      headline: textValue(formData, "headline") || null,
      bio: textValue(formData, "bio") || null,
      location: textValue(formData, "location") || null,
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
      founding_price_locked: formData.get("founding_price_locked") === "on",
      contact_scan_status: hasContactInfo ? "flagged" : "clear",
      admin_premium_access_until: textValue(formData, "admin_premium_access_until") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

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
