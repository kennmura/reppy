"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appUrl } from "./appUrl";
import { getAccountUserOrRedirect, getAdminUserOrRedirect, getCoachContextOrRedirect } from "./auth";
import { sendCoachReviewInviteEmail } from "./email";
import { createNotification } from "./notifications";
import { createSupabaseAdminClient } from "./supabase";
import type { Coach, CoachReview, TrainingRequest, TrainingSession } from "./types";

const allowedRelationships = ["parent_guardian", "player", "adult_player", "former_player"] as const;
const allowedAgeBands = ["U8", "U10", "U12", "U14", "high_school", "college", "adult"] as const;
const allowedTags = [
  "Great with kids",
  "Technical training",
  "Reliable",
  "Clear communication",
  "Good value",
  "Motivating",
  "Professional",
  "Tactical insight",
  "Fitness",
  "College guidance",
];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function inviteToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function safeRating(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

function optionalRating(value: string) {
  return value ? safeRating(value) : null;
}

function safeRelationship(value: string): (typeof allowedRelationships)[number] {
  return allowedRelationships.includes(value as (typeof allowedRelationships)[number])
    ? (value as (typeof allowedRelationships)[number])
    : "parent_guardian";
}

function safeAgeBand(value: string) {
  return allowedAgeBands.includes(value as (typeof allowedAgeBands)[number]) ? value : null;
}

function selectedTags(formData: FormData) {
  const raw = formData.getAll("tags");
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => allowedTags.includes(value))
    .slice(0, 8);
}

function reviewReturnPath(coachSlug: string, error: string) {
  return `/coaches/${coachSlug}?review_error=${encodeURIComponent(error)}#reviews`;
}

export async function createCoachReviewInviteAction(formData: FormData) {
  const { coach, user } = await getCoachContextOrRedirect();
  const email = normalizedEmail(textValue(formData, "email"));
  const note = textValue(formData, "note");

  if (!email || !email.includes("@")) {
    redirect("/coach/reviews?error=invalid-email");
  }

  const supabase = createSupabaseAdminClient();
  const cooldown = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentInvite, error: recentError } = await supabase
    .from("coach_review_invites")
    .select("id")
    .eq("coach_id", coach.id)
    .eq("invited_email_normalized", email)
    .in("status", ["sent", "opened"])
    .gte("created_at", cooldown)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (recentError) {
    throw recentError;
  }

  if (recentInvite) {
    redirect("/coach/reviews?error=recent-invite");
  }

  const token = inviteToken();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("coach_review_invites").insert({
    coach_id: coach.id,
    invited_email_normalized: email,
    invite_token: token,
    invited_by_user_id: user.id,
    invite_note: note || null,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[reviews] failed to create coach review invite", {
      coachId: coach.id,
      code: error.code,
      message: error.message,
    });
    redirect("/coach/reviews?error=invite-failed");
  }

  await sendCoachReviewInviteEmail({
    to: email,
    coachName: coach.full_name,
    inviteUrl: appUrl(`/reviews/${token}`),
    note,
  });

  revalidatePath("/coach/reviews");
  redirect(`/coach/reviews?invite=created&token=${encodeURIComponent(token)}`);
}

export async function revokeCoachReviewInviteAction(formData: FormData) {
  const { coach } = await getCoachContextOrRedirect();
  const inviteId = textValue(formData, "invite_id");

  if (!inviteId) {
    redirect("/coach/reviews?error=missing-invite");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("coach_review_invites")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("coach_id", coach.id)
    .neq("status", "completed");

  if (error) {
    throw error;
  }

  revalidatePath("/coach/reviews");
  redirect("/coach/reviews?invite=revoked");
}

export async function submitCoachReviewAction(formData: FormData) {
  const user = await getAccountUserOrRedirect();
  const coachId = textValue(formData, "coach_id");
  const inviteTokenValue = textValue(formData, "invite_token");
  const trainingRequestId = textValue(formData, "training_request_id");
  const overallRating = safeRating(textValue(formData, "overall_rating"));
  const reviewBody = textValue(formData, "review_body");

  if (!coachId || !overallRating || reviewBody.length < 20) {
    redirect("/coaches?review_error=missing-review-fields");
  }

  const supabase = createSupabaseAdminClient();
  const { data: coach, error: coachError } = await supabase.from("coaches").select("*").eq("id", coachId).maybeSingle<Coach>();

  if (coachError) {
    throw coachError;
  }

  if (!coach) {
    redirect("/coaches?review_error=coach-not-found");
  }

  if (coach.user_id === user.id) {
    redirect(reviewReturnPath(coach.slug, "self-review"));
  }

  const { data: duplicate } = await supabase
    .from("coach_reviews")
    .select("id")
    .eq("coach_id", coach.id)
    .eq("reviewer_user_id", user.id)
    .neq("status", "removed")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (duplicate) {
    redirect(reviewReturnPath(coach.slug, "duplicate"));
  }

  let reviewType: CoachReview["review_type"] = "invited_client";
  let reviewInviteId: string | null = null;
  let request: TrainingRequest | null = null;
  let session: TrainingSession | null = null;

  if (inviteTokenValue) {
    const { data: invite, error: inviteError } = await supabase
      .from("coach_review_invites")
      .select("*")
      .eq("invite_token", inviteTokenValue)
      .eq("coach_id", coach.id)
      .maybeSingle<{ id: string; status: string; invited_email_normalized: string; expires_at: string | null }>();

    if (inviteError) {
      throw inviteError;
    }

    const expired = invite?.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;
    if (
      !invite ||
      expired ||
      invite.status === "revoked" ||
      invite.status === "completed" ||
      normalizedEmail(user.email ?? "") !== invite.invited_email_normalized
    ) {
      redirect(reviewReturnPath(coach.slug, "invite-invalid"));
    }

    reviewInviteId = invite.id;
  } else if (trainingRequestId) {
    const { data: foundRequest, error: requestError } = await supabase
      .from("training_requests")
      .select("*")
      .eq("id", trainingRequestId)
      .eq("coach_id", coach.id)
      .or(`requester_user_id.eq.${user.id},guardian_user_id.eq.${user.id}`)
      .maybeSingle<TrainingRequest>();

    if (requestError) {
      throw requestError;
    }

    if (!foundRequest || !["paid_confirmed", "completed"].includes(foundRequest.status)) {
      redirect(reviewReturnPath(coach.slug, "session-not-verified"));
    }

    const { data: foundSession } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("training_request_id", foundRequest.id)
      .eq("coach_id", coach.id)
      .in("status", ["paid_confirmed", "confirmed", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<TrainingSession>();

    reviewType = "verified_session";
    request = foundRequest;
    session = foundSession ?? null;
  } else {
    redirect(reviewReturnPath(coach.slug, "invite-required"));
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("coach_reviews").insert({
    coach_id: coach.id,
    reviewer_user_id: user.id,
    training_request_id: request?.id ?? null,
    training_session_id: session?.id ?? null,
    review_invite_id: reviewInviteId,
    review_type: reviewType,
    status: "pending",
    overall_rating: overallRating,
    communication_rating: optionalRating(textValue(formData, "communication_rating")),
    reliability_rating: optionalRating(textValue(formData, "reliability_rating")),
    training_quality_rating: optionalRating(textValue(formData, "training_quality_rating")),
    review_title: textValue(formData, "review_title") || null,
    review_body: reviewBody,
    reviewer_relationship: safeRelationship(textValue(formData, "reviewer_relationship")),
    player_age_band: safeAgeBand(textValue(formData, "player_age_band")),
    training_type: textValue(formData, "training_type") || null,
    tags: selectedTags(formData),
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    console.error("[reviews] failed to submit coach review", {
      coachId: coach.id,
      userId: user.id,
      code: insertError.code,
      message: insertError.message,
    });
    redirect(reviewReturnPath(coach.slug, insertError.code === "23505" ? "duplicate" : "submit-failed"));
  }

  if (reviewInviteId) {
    await supabase
      .from("coach_review_invites")
      .update({
        status: "completed",
        completed_by_user_id: user.id,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", reviewInviteId);
  }

  await createNotification({
    userId: coach.user_id,
    type: "system",
    title: "New review submitted",
    body: "A client review is waiting for moderation.",
    actionUrl: "/coach/reviews",
  }).catch(() => null);

  revalidatePath(`/coaches/${coach.slug}`);
  revalidatePath("/coach/reviews");
  revalidatePath("/admin/reviews");
  redirect(`/reviews/thanks?coach=${encodeURIComponent(coach.slug)}`);
}

export async function replyToCoachReviewAction(formData: FormData) {
  const { coach } = await getCoachContextOrRedirect();
  const reviewId = textValue(formData, "review_id");
  const reply = textValue(formData, "coach_reply");

  if (!reviewId || reply.length < 3) {
    redirect("/coach/reviews?error=missing-reply");
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("coach_reviews")
    .update({ coach_reply: reply, coach_reply_at: now, updated_at: now })
    .eq("id", reviewId)
    .eq("coach_id", coach.id)
    .in("status", ["published", "reported"]);

  if (error) {
    throw error;
  }

  revalidatePath("/coach/reviews");
  revalidatePath(`/coaches/${coach.slug}`);
  redirect("/coach/reviews?review=replied");
}

export async function reportCoachReviewAction(formData: FormData) {
  const { coach } = await getCoachContextOrRedirect();
  const reviewId = textValue(formData, "review_id");
  const reason = textValue(formData, "reason");

  if (!reviewId || !reason) {
    redirect("/coach/reviews?error=missing-report");
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("coach_reviews")
    .update({ status: "reported", reported_at: now, report_reason: reason, updated_at: now })
    .eq("id", reviewId)
    .eq("coach_id", coach.id)
    .in("status", ["published", "reported"]);

  if (error) {
    throw error;
  }

  await supabase.from("coach_review_reports").insert({
    review_id: reviewId,
    reporter_user_id: coach.user_id,
    reason,
    status: "new",
  });

  revalidatePath("/coach/reviews");
  revalidatePath("/admin/reviews");
  redirect("/coach/reviews?review=reported");
}

export async function moderateCoachReviewAction(formData: FormData) {
  const admin = await getAdminUserOrRedirect();
  const reviewId = textValue(formData, "review_id");
  const decision = textValue(formData, "decision");

  if (!reviewId || !["published", "hidden", "removed"].includes(decision)) {
    redirect("/admin/reviews?error=invalid-decision");
  }

  const now = new Date().toISOString();
  const payload: Record<string, string | null> = {
    status: decision,
    moderated_by: admin.id,
    moderated_at: now,
    updated_at: now,
  };

  if (decision === "published") {
    payload.published_at = now;
  }

  const supabase = createSupabaseAdminClient();
  const { data: review, error } = await supabase
    .from("coach_reviews")
    .update(payload)
    .eq("id", reviewId)
    .select("coach_id")
    .single<{ coach_id: string }>();

  if (error) {
    throw error;
  }

  const { data: coach } = await supabase.from("coaches").select("slug").eq("id", review.coach_id).maybeSingle<{ slug: string }>();

  if (coach?.slug) {
    revalidatePath(`/coaches/${coach.slug}`);
  }
  revalidatePath("/admin/reviews");
  revalidatePath("/coach/reviews");
  redirect(`/admin/reviews?review=${decision}`);
}
