import { NextResponse } from "next/server";
import { repairAccountForAuthUser } from "@/lib/auth";
import { isPhoneVerificationBypassed } from "@/lib/accountConfig";
import {
  accountRequestProfileFrom,
  ageRangeFromProfile,
  currentLevelFromProfile,
  isMinorFromProfile,
  missingAccountRequestProfileFields,
} from "@/lib/accountProfile";
import { getUserCoachingPreference } from "@/lib/data";
import { appUrl, sendFreeCoachLockedRequestEmail } from "@/lib/email";
import { getMessageAccess } from "@/lib/entitlements";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";
import type { Coach, CoachService, ConversationSafeMetadata } from "@/lib/types";

const requiredFields = ["training_goals", "preferred_days_times"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

  return jsonError("SERVER_ERROR", "Training requests are temporarily unavailable. Please try again.", 500);
}

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const { data: authData } = await supabaseAuth.auth.getUser();

    if (!authData.user) {
      return jsonError("AUTH_REQUIRED", "Create an account or sign in to request training.", 401);
    }

    const { profile, privateDetails } = await repairAccountForAuthUser(authData.user);

    if (!profile || !["parent", "adult_player"].includes(profile.role)) {
      return jsonError("UNAUTHORIZED", "Use a parent or adult player account to request training.", 403);
    }

    if (profile.account_status !== "active") {
      return jsonError("UNAUTHORIZED", "This account cannot request training right now.", 403);
    }

    if (!authData.user.email_confirmed_at && !profile.email_verified_at) {
      return jsonError("EMAIL_NOT_VERIFIED", "Verify your email before requesting training.", 403);
    }

    const accountPreference = await getUserCoachingPreference(authData.user.id);
    const accountProfile = accountRequestProfileFrom({ profile, preference: accountPreference });
    const missingProfileFields = missingAccountRequestProfileFields(accountProfile);

    if (missingProfileFields.length) {
      return jsonError(
        "PROFILE_INCOMPLETE",
        "Please complete your player profile before requesting training.",
        409,
        Object.fromEntries(missingProfileFields.map((field) => [field, "Required"])),
      );
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

    const playerAge = accountProfile.playerAge;
    const isMinor = isMinorFromProfile(accountProfile);
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
    const preferredLocation = cleanString(payload.preferred_location) || accountProfile.preferredLocation;
    const computedAgeRange = ageRangeFromProfile(accountProfile);
    const computedGeneralArea = generalArea(preferredLocation);
    const currentLevel = currentLevelFromProfile(accountProfile);
    const serviceId = cleanString(payload.service_id);
    let selectedService: Pick<CoachService, "id" | "title" | "description" | "coach_id"> | null = null;

    const supabaseAdmin = createSupabaseAdminClient();
    if (
      !privateDetails?.phone_verified_at &&
      !profile.phone_verified_at &&
      !authData.user.phone_confirmed_at &&
      !isPhoneVerificationBypassed()
    ) {
      return jsonError("PHONE_NOT_VERIFIED", "Verify your phone number before requesting training.", 403);
    }

    const { data: requestedCoach } = await supabaseAdmin
      .from("coaches")
      .select("id, user_id, is_published, accepting_requests")
      .eq("slug", coachSlug)
      .maybeSingle<Pick<Coach, "id" | "user_id" | "is_published" | "accepting_requests">>();

    if (!requestedCoach?.is_published || requestedCoach.accepting_requests === false) {
      return jsonError("COACH_UNAVAILABLE", "We could not find this coach.", 404);
    }

    if (requestedCoach.user_id === authData.user.id) {
      return jsonError("UNAUTHORIZED", "Coaches cannot request training from their own profile.", 403);
    }

    if (serviceId) {
      const { data: service, error: serviceError } = await supabaseAdmin
        .from("coach_services")
        .select("id, coach_id, title, description")
        .eq("id", serviceId)
        .maybeSingle<Pick<CoachService, "id" | "coach_id" | "title" | "description">>();

      if (serviceError) {
        console.error("[trainingRequests] Failed to verify selected service", {
          userId: authData.user.id,
          coachSlug,
          serviceId,
          error: serviceError.message,
          code: serviceError.code,
        });
        return jsonError("SERVICE_NOT_FOUND", "We could not find that training service.", 404);
      }

      if (!service) {
        return jsonError("SERVICE_NOT_FOUND", "We could not find that training service.", 404);
      }

      if (service.coach_id !== requestedCoach.id) {
        return jsonError("SERVICE_COACH_MISMATCH", "That training service does not belong to this coach.", 400);
      }

      selectedService = service;
    }

    const firstMessage = [
      `Service: ${selectedService?.title ?? "General training request"}`,
      `Training goals: ${cleanString(payload.training_goals)}`,
      `Player: ${accountProfile.playerName}`,
      accountProfile.guardianName ? `Parent/guardian: ${accountProfile.guardianName}` : "",
      `Club/team: ${accountProfile.currentTeam}`,
      cleanString(payload.message) ? `Message: ${cleanString(payload.message)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    console.info("[trainingRequests] Creating training request", {
      userId: authData.user.id,
      role: profile.role,
      coachSlug,
      coachId: requestedCoach.id,
      serviceId: selectedService?.id ?? null,
      serviceTitle: selectedService?.title ?? "General training request",
      profileComplete: true,
      phoneVerificationBypassed: isPhoneVerificationBypassed(),
    });

    const { data: rpcRows, error: rpcError } = await supabaseAuth.rpc("create_training_request_verified", {
      p_client_request_id: clientRequestId,
      p_coach_slug: coachSlug,
      p_requester_display_name: accountProfile.playerName,
      p_player_age: playerAge,
      p_age_range: computedAgeRange,
      p_current_level: currentLevel || null,
      p_training_goals: cleanString(payload.training_goals),
      p_preferred_location: preferredLocation || null,
      p_general_location: computedGeneralArea,
      p_preferred_days_times: cleanString(payload.preferred_days_times) || null,
      p_guardian_name: accountProfile.guardianName || null,
      p_is_minor: isMinor,
      p_guardian_confirmed: guardianConfirmed,
      p_first_message: firstMessage,
    });

    if (rpcError || !rpcRows?.length) {
      console.error("[trainingRequests] Supabase request RPC failed", {
        userId: authData.user.id,
        role: profile.role,
        coachId: requestedCoach.id,
        coachSlug,
        serviceId: selectedService?.id ?? null,
        serviceTitle: selectedService?.title ?? "General training request",
        error: rpcError?.message ?? "RPC returned no rows",
        code: rpcError?.code,
      });
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

    if (selectedService) {
      const servicePayload = {
        service_id: selectedService.id,
        service_title: selectedService.title,
        service_description: selectedService.description,
      };
      const [{ error: requestServiceError }, { error: conversationServiceError }] = await Promise.all([
        supabase.from("training_requests").update(servicePayload).eq("id", requestId),
        supabase.from("conversation_private_details").update(servicePayload).eq("conversation_id", conversationId),
      ]);

      if (requestServiceError || conversationServiceError) {
        console.error("[trainingRequests] Failed to persist selected service metadata", {
          userId: authData.user.id,
          requestId,
          conversationId,
          requestError: requestServiceError?.message,
          requestCode: requestServiceError?.code,
          conversationError: conversationServiceError?.message,
          conversationCode: conversationServiceError?.code,
        });
      }
    }
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
  } catch (error) {
    console.error("[trainingRequests] Unexpected request creation failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError("SERVER_ERROR", "Training requests are temporarily unavailable. Please try again.", 500);
  }
}
