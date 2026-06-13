"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCoachContextOrRedirect } from "./auth";
import { appUrl, sendPlatformEmail } from "./email";
import { getMessageAccess, startCoachTrial } from "./entitlements";
import { scanForPublicContactInfo } from "./profileModeration";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase";
import type { CoachApplication, TrainingRequest } from "./types";

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

  if (!email || !password) {
    redirect("/coach/login?error=missing-fields");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/coach/login?error=invalid-login");
  }

  redirect("/coach/messages");
}

export async function signOutCoach() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/coach/login");
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

  const now = new Date().toISOString();
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
      updated_at: now,
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  const { data: details } = await supabase
    .from("conversation_private_details")
    .select("requester_email")
    .eq("conversation_id", conversationId)
    .maybeSingle<{ requester_email: string | null }>();

  if (details?.requester_email) {
    await sendPlatformEmail({
      to: details.requester_email,
      subject: "Your coach replied",
      body: "Your coach has replied to your training request. Sign in to view the conversation.",
      ctaLabel: "View Conversation",
      ctaUrl: appUrl(`/account/messages/${conversationId}`),
    });
  }

  revalidatePath("/coach/messages");
  revalidatePath(`/coach/messages/${conversationId}`);
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
