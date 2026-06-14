import { NextResponse } from "next/server";
import { appUrl, sendFreeCoachLockedRequestEmail } from "@/lib/email";
import { getMessageAccess } from "@/lib/entitlements";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";
import type { AccountPrivateDetails, Coach, ConversationSafeMetadata, UserProfile } from "@/lib/types";

const requiredFields = ["name", "player_age", "training_goals", "preferred_days_times"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ageRange(value: string) {
  const age = Number.parseInt(value, 10);
  if (Number.isNaN(age)) {
    return value;
  }
  if (age < 13) {
    return "Under 13";
  }
  if (age <= 15) {
    return "13-15";
  }
  if (age <= 18) {
    return "16-18";
  }
  return "19+";
}

function generalArea(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "Area not provided";
  }
  return clean.split(",")[0]?.trim() || clean;
}

function jsonError(code: string, message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(
    {
      success: false,
      error: fields ? { code, message, fields } : { code, message },
    },
    { status },
  );
}

function mapRpcError(message: string) {
  if (message.includes("PHONE_NOT_VERIFIED")) {
    return jsonError("PHONE_NOT_VERIFIED", "Verify your phone number before requesting training.", 403);
  }
  if (message.includes("EMAIL_NOT_VERIFIED")) {
    return jsonError("EMAIL_NOT_VERIFIED", "Verify your email before requesting training.", 403);
  }
  if (message.includes("WRONG_ROLE") || message.includes("SELF_REQUEST_FORBIDDEN")) {
    return jsonError("UNAUTHORIZED", "This account cannot submit that training request.", 403);
  }
  if (message.includes("ACCOUNT_NOT_ACTIVE")) {
    return jsonError("UNAUTHORIZED", "This account cannot request training right now.", 403);
  }
  if (message.includes("COACH_UNAVAILABLE")) {
    return jsonError("COACH_UNAVAILABLE", "This coach is not accepting requests right now.", 404);
  }
  if (message.includes("RATE_LIMITED")) {
    return jsonError("RATE_LIMITED", "Please wait before sending another request.", 429);
  }
  if (message.includes("ACTIVE_DUPLICATE")) {
    return jsonError("DUPLICATE_ACTIVE_REQUEST", "You already have an active request with this coach.", 409);
  }
  if (message.includes("VALIDATION_ERROR")) {
    return jsonError("VALIDATION_ERROR", "Please correct the highlighted fields.", 400);
  }

  return jsonError("SERVER_ERROR", "Could not create the training request.", 500);
}

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: authData } = await supabaseAuth.auth.getUser();

    if (!authData.user) {
      return jsonError("AUTH_REQUIRED", "Create an account or sign in to request training.", 401);
    }

    if (!authData.user.email_confirmed_at) {
      return jsonError("EMAIL_NOT_VERIFIED", "Verify your email before requesting training.", 403);
    }

    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!payload) {
      return jsonError("VALIDATION_ERROR", "Please correct the highlighted fields.", 400);
    }

    const fields: Record<string, string> = {};
    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== "string" || !payload[field].trim()) {
        fields[field] = "Required";
      }
    }

    const clientRequestId = cleanString(payload.client_request_id);
    if (!uuidPattern.test(clientRequestId)) {
      fields.client_request_id = "Invalid submission id";
    }

    const playerAge = cleanString(payload.player_age);
    const parsedAge = Number.parseInt(playerAge, 10);
    const isMinor = !Number.isNaN(parsedAge) && parsedAge < 18;
    const guardianConfirmed = payload.guardian_confirmed === true || payload.guardian_confirmed === "on";

    if (isMinor && !guardianConfirmed) {
      fields.guardian_confirmed = "Guardian confirmation is required";
    }

    if (cleanString(payload.training_goals).length > 2000) {
      fields.training_goals = "Keep training goals under 2000 characters";
    }

    if (cleanString(payload.message).length > 1500) {
      fields.message = "Keep the message under 1500 characters";
    }

    if (Object.keys(fields).length) {
      return jsonError("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const coachSlug = cleanString(payload.coach_slug) || "ken-murakawa";
    const preferredLocation = cleanString(payload.preferred_location);
    const computedAgeRange = ageRange(playerAge);
    const computedGeneralArea = generalArea(preferredLocation);
    const firstMessage = [
      `Training goals: ${cleanString(payload.training_goals)}`,
      cleanString(payload.message) ? `Message: ${cleanString(payload.message)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const supabaseAdmin = createSupabaseAdminClient();
    const [{ data: profile }, { data: privateDetails }] = await Promise.all([
      supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle<UserProfile>(),
      supabaseAdmin
        .from("account_private_details")
        .select("*")
        .eq("user_id", authData.user.id)
        .maybeSingle<AccountPrivateDetails>(),
    ]);

    if (!profile || !["parent", "adult_player"].includes(profile.role)) {
      return jsonError("UNAUTHORIZED", "Use a parent or adult player account to request training.", 403);
    }

    if (profile.account_status !== "active") {
      return jsonError("UNAUTHORIZED", "This account cannot request training right now.", 403);
    }

    if (!privateDetails?.phone_verified_at && !profile.phone_verified_at && !authData.user.phone_confirmed_at) {
      return jsonError("PHONE_NOT_VERIFIED", "Verify your phone number before requesting training.", 403);
    }

    const { data: requestedCoach } = await supabaseAdmin
      .from("coaches")
      .select("id, user_id, is_published, accepting_requests")
      .eq("slug", coachSlug)
      .maybeSingle<Pick<Coach, "id" | "user_id" | "is_published" | "accepting_requests">>();

    if (!requestedCoach?.is_published || requestedCoach.accepting_requests === false) {
      return jsonError("COACH_UNAVAILABLE", "This coach is not accepting requests right now.", 404);
    }

    if (requestedCoach.user_id === authData.user.id) {
      return jsonError("UNAUTHORIZED", "Coaches cannot request training from their own profile.", 403);
    }

    const { data: rpcRows, error: rpcError } = await supabaseAuth.rpc("create_training_request_verified", {
      p_client_request_id: clientRequestId,
      p_coach_slug: coachSlug,
      p_requester_display_name: cleanString(payload.name),
      p_player_age: playerAge,
      p_age_range: computedAgeRange,
      p_current_level: cleanString(payload.current_level) || null,
      p_training_goals: cleanString(payload.training_goals),
      p_preferred_location: preferredLocation || null,
      p_general_location: computedGeneralArea,
      p_preferred_days_times: cleanString(payload.preferred_days_times) || null,
      p_guardian_name: cleanString(payload.guardian_name) || null,
      p_is_minor: isMinor,
      p_guardian_confirmed: guardianConfirmed,
      p_first_message: firstMessage,
    });

    if (rpcError || !rpcRows?.length) {
      return mapRpcError(rpcError?.message ?? "SERVER_ERROR");
    }

    const rpcResult = rpcRows[0] as {
      request_id: string;
      conversation_id: string;
      was_existing: boolean;
    };
    const conversationId = rpcResult.conversation_id;
    const requestId = rpcResult.request_id;
    const supabase = supabaseAdmin;
    const { data: conversation } = await supabase
      .from("conversations")
      .select(
        "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, free_coach_alert_sent_at, free_coach_alert_attempted_at, free_coach_alert_error, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
      )
      .eq("id", conversationId)
      .maybeSingle<ConversationSafeMetadata>();

    if (!conversation?.coach_id) {
      return NextResponse.json({ success: true, requestId, conversationId }, { status: rpcResult.was_existing ? 200 : 201 });
    }

    const { data: coach } = await supabase
      .from("coaches")
      .select("*")
      .eq("id", conversation.coach_id)
      .maybeSingle<Coach>();

    if (!coach) {
      return NextResponse.json({ success: true, requestId, conversationId }, { status: rpcResult.was_existing ? 200 : 201 });
    }

    const access = await getMessageAccess({ coach, coachUserId: coach.user_id ?? null });
    const coachActionUrl = `/coach/messages/${conversationId}`;

    if (coach.user_id && !rpcResult.was_existing) {
      await sendPushNotificationToUser(coach.user_id, {
        title: access.hasAccess ? "New training request" : "New training request waiting",
        body: access.hasAccess
          ? "A new request is waiting in your Message Center."
          : "Open your Message Center to view the request.",
        url: coachActionUrl,
        tag: `conversation-${conversationId}`,
      });
    }

    if (!rpcResult.was_existing && !access.hasAccess && coach.email && !conversation.free_coach_alert_sent_at) {
      const attemptedAt = new Date().toISOString();
      await supabase
        .from("conversations")
        .update({ free_coach_alert_attempted_at: attemptedAt })
        .eq("id", conversationId)
        .is("free_coach_alert_sent_at", null);

      const result = await sendFreeCoachLockedRequestEmail({
        to: coach.email,
        sport: conversation.sport,
        ageRange: conversation.age_range,
        generalLocation: conversation.general_location,
        requestType: conversation.request_type,
        conversationUrl: appUrl(coachActionUrl),
      });

      await supabase
        .from("conversations")
        .update({
          free_coach_alert_sent_at: result.sent ? new Date().toISOString() : null,
          free_coach_alert_error: result.sent ? null : result.error ?? "not-sent",
        })
        .eq("id", conversationId);
    }

    return NextResponse.json({ success: true, requestId, conversationId }, { status: rpcResult.was_existing ? 200 : 201 });
  } catch {
    return jsonError("VALIDATION_ERROR", "Please correct the highlighted fields.", 400);
  }
}
