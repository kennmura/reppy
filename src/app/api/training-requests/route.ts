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
import { appUrl } from "@/lib/appUrl";
import { sendFreeCoachLockedRequestEmail } from "@/lib/email";
import { getMessageAccess } from "@/lib/entitlements";
import { createNotification } from "@/lib/notifications";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";
import type { Coach, CoachAvailabilityBlock, CoachService, ConversationSafeMetadata } from "@/lib/types";

const requiredFields = ["training_goals", "preferred_days_times"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function scheduleText({
  requestedDate,
  requestedStartTime,
  requestedEndTime,
  timezone,
}: {
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  timezone: string;
}) {
  if (!requestedDate) {
    return "";
  }

  const [year, month, day] = requestedDate.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!requestedStartTime) {
    return `Requested date: ${dateLabel}`;
  }

  return `Requested time: ${dateLabel}, ${formatTime(requestedStartTime)} to ${formatTime(requestedEndTime)} ${timezone}`;
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  return new Date(2026, 0, 1, Number(hourText), Number(minuteText)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function generalArea(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "Area not provided";
  }
  return clean.split(",")[0]?.trim() || clean;
}

function isMissingColumnError(error: { message?: string; details?: string; code?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return error.code === "PGRST204" || (/(column|schema cache|not find)/i.test(text) && /[a-z_]+/i.test(text));
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
    const accountProfile = accountRequestProfileFrom({ profile, preference: accountPreference, privateDetails });
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
    const selectedAvailabilityBlockId = cleanString(payload.selected_availability_block_id);
    const requestedDateInput = cleanString(payload.requested_date);
    const requestedStartTimeInput = cleanString(payload.requested_start_time);
    const requestedEndTimeInput = cleanString(payload.requested_end_time);
    const requestedDate = validIsoDate(requestedDateInput) ? requestedDateInput : "";
    const requestedStartTime = validTime(requestedStartTimeInput) ? requestedStartTimeInput : "";
    const requestedEndTime = validTime(requestedEndTimeInput) ? requestedEndTimeInput : "";
    const timezone = cleanString(payload.timezone) || "America/New_York";
    let selectedService: Pick<CoachService, "id" | "title" | "description" | "coach_id"> | null = null;
    let selectedAvailability: CoachAvailabilityBlock | null = null;

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
      .select("*")
      .eq("slug", coachSlug)
      .maybeSingle<Coach>();

    if (!requestedCoach?.is_published || requestedCoach.accepting_requests === false) {
      return jsonError("COACH_UNAVAILABLE", "We could not find this coach.", 404);
    }

    if (requestedCoach.user_id === authData.user.id) {
      return jsonError("UNAUTHORIZED", "Coaches cannot request training from their own profile.", 403);
    }

    if (requestedDateInput && !requestedDate) {
      return jsonError("VALIDATION_ERROR", "Choose a valid requested date.", 400, { requested_date: "Invalid date" });
    }

    if ((requestedStartTimeInput && !requestedStartTime) || (requestedEndTimeInput && !requestedEndTime)) {
      return jsonError("VALIDATION_ERROR", "Choose a valid requested time.", 400, {
        requested_time: "Invalid time",
      });
    }

    if (requestedStartTime && requestedEndTime && requestedEndTime <= requestedStartTime) {
      return jsonError("VALIDATION_ERROR", "End time must be after start time.", 400, {
        requested_time: "End time must be after start time",
      });
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

    if (selectedAvailabilityBlockId) {
      const { data: availability, error: availabilityError } = await supabaseAdmin
        .from("coach_availability_blocks")
        .select("*")
        .eq("id", selectedAvailabilityBlockId)
        .maybeSingle<CoachAvailabilityBlock>();

      if (availabilityError) {
        console.error("[trainingRequests] Failed to verify selected availability", {
          userId: authData.user.id,
          coachSlug,
          coachId: requestedCoach.id,
          selectedAvailabilityBlockId,
          error: availabilityError.message,
          code: availabilityError.code,
        });
        return jsonError("VALIDATION_ERROR", "We could not verify that availability slot.", 400, {
          selected_availability_block_id: "Invalid availability",
        });
      }

      if (!availability || availability.coach_id !== requestedCoach.id) {
        return jsonError("VALIDATION_ERROR", "That availability slot does not belong to this coach.", 400, {
          selected_availability_block_id: "Invalid availability",
        });
      }

      selectedAvailability = availability;
    }

    const supabase = supabaseAdmin;
    const finalRequestedDate = selectedAvailability?.availability_date ?? requestedDate;
    const finalRequestedStartTime = selectedAvailability?.start_time?.slice(0, 5) ?? requestedStartTime;
    const finalRequestedEndTime = selectedAvailability?.end_time?.slice(0, 5) ?? requestedEndTime;
    const finalTimezone = selectedAvailability?.timezone || requestedCoach.timezone || timezone || "America/New_York";
    const requestedTimeText = scheduleText({
      requestedDate: finalRequestedDate,
      requestedStartTime: finalRequestedStartTime,
      requestedEndTime: finalRequestedEndTime,
      timezone: finalTimezone,
    });
    const requestType = selectedService?.title ?? (currentLevel || requestedCoach.category || "Training request");
    const now = new Date().toISOString();
    const firstMessage = [
      `Service: ${selectedService?.title ?? "General training request"}`,
      requestedTimeText,
      `Training goals: ${cleanString(payload.training_goals)}`,
      `Player: ${accountProfile.playerName}`,
      `Player age: ${accountProfile.playerAge}`,
      accountProfile.guardianName ? `Parent/guardian: ${accountProfile.guardianName}` : "",
      `Club/team: ${accountProfile.currentTeam}`,
      `Preferred days/times: ${cleanString(payload.preferred_days_times)}`,
      preferredLocation ? `Preferred location: ${preferredLocation}` : "",
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
      selectedAvailabilityBlockId: selectedAvailability?.id ?? null,
      requestedDate: finalRequestedDate || null,
      requestedStartTime: finalRequestedStartTime || null,
      requestedEndTime: finalRequestedEndTime || null,
      profileComplete: true,
      phoneVerificationBypassed: isPhoneVerificationBypassed(),
    });

    const { data: existingRequest, error: existingError } = await supabase
      .from("training_requests")
      .select("id, conversation_id")
      .eq("requester_user_id", authData.user.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle<{ id: string; conversation_id: string | null }>();

    if (existingError) {
      console.error("[trainingRequests] Idempotency lookup failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        error: existingError.message,
        code: existingError.code,
      });
      if (!isMissingColumnError(existingError)) {
        return jsonError("REQUEST_LOOKUP_FAILED", "We could not verify this request. Please try again.", 500);
      }
    }

    if (existingRequest?.id) {
      return NextResponse.json(
        { success: true, requestId: existingRequest.id, conversationId: existingRequest.conversation_id ?? "" },
        { status: 200 },
      );
    }

    const { count: recentCount, error: rateError } = await supabase
      .from("training_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_user_id", authData.user.id)
      .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (rateError) {
      console.error("[trainingRequests] Rate-limit lookup failed", {
        userId: authData.user.id,
        error: rateError.message,
        code: rateError.code,
      });
    } else if ((recentCount ?? 0) >= 5) {
      return jsonError("RATE_LIMITED", "Please wait before sending another request.", 429);
    }

    const { data: duplicateActive, error: duplicateError } = await supabase
      .from("training_requests")
      .select("id")
      .eq("requester_user_id", authData.user.id)
      .eq("coach_id", requestedCoach.id)
      .in("status", ["pending", "accepted_pending_payment", "paid_confirmed"])
      .gt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (duplicateError) {
      console.error("[trainingRequests] Active duplicate lookup failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        error: duplicateError.message,
        code: duplicateError.code,
      });
    }

    if (!duplicateError && duplicateActive?.length) {
      return jsonError(
        "DUPLICATE_ACTIVE_REQUEST",
        "You already have an active request with this coach. Open your Message Center to continue the conversation.",
        409,
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        coach_id: requestedCoach.id,
        coach_user_id: requestedCoach.user_id,
        requester_user_id: authData.user.id,
        sport: requestedCoach.sport || "Training",
        request_type: requestType,
        age_range: computedAgeRange,
        general_location: computedGeneralArea,
        status: "new",
        is_unread_by_coach: true,
        retention_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_message_at: now,
        updated_at: now,
      })
      .select(
        "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, free_coach_alert_sent_at, free_coach_alert_attempted_at, free_coach_alert_error, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
      )
      .single<ConversationSafeMetadata>();

    if (conversationError || !conversation) {
      console.error("[trainingRequests] Conversation creation failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        error: conversationError?.message,
        code: conversationError?.code,
      });
      return jsonError("CONVERSATION_CREATE_FAILED", "We could not start the coach conversation. Please try again.", 500);
    }

    const conversationId = conversation.id;

    const participantRows: Array<{
      conversation_id: string;
      user_id: string;
      role: "coach" | "parent" | "player";
      unread_count: number;
      last_read_at?: string;
    }> = [
      {
        conversation_id: conversationId,
        user_id: authData.user.id,
        role: profile.role === "adult_player" ? "player" : "parent",
        unread_count: 0,
        last_read_at: now,
      },
    ];

    if (requestedCoach.user_id) {
      participantRows.unshift({
        conversation_id: conversationId,
        user_id: requestedCoach.user_id,
        role: "coach",
        unread_count: 1,
      });
    }
    const { error: participantError } = await supabase.from("conversation_participants").insert(participantRows);

    if (participantError) {
      console.error("[trainingRequests] Conversation participant creation failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        conversationId,
        error: participantError.message,
        code: participantError.code,
      });
    }

    const privateDetailsPayload = {
      conversation_id: conversationId,
      requester_display_name: accountProfile.playerName,
      requester_email: authData.user.email ?? "",
      requester_phone: privateDetails?.phone_e164 ?? null,
      guardian_name: accountProfile.guardianName || null,
      service_id: selectedService?.id ?? null,
      service_title: selectedService?.title ?? null,
      service_description: selectedService?.description ?? null,
      selected_availability_block_id: selectedAvailability?.id ?? null,
      requested_date: finalRequestedDate || null,
      requested_start_time: finalRequestedStartTime || null,
      requested_end_time: finalRequestedEndTime || null,
      timezone: finalTimezone,
      player_age_at_request: accountProfile.playerAgeAtRequest,
      exact_location: preferredLocation || null,
      preferred_days_times: cleanString(payload.preferred_days_times) || null,
      current_level: currentLevel || null,
      current_team: accountProfile.currentTeam,
    };
    let { error: privateDetailsError } = await supabase.from("conversation_private_details").insert(privateDetailsPayload);

    if (privateDetailsError && isMissingColumnError(privateDetailsError)) {
      const legacyPayload: Record<string, unknown> = { ...privateDetailsPayload };
      delete legacyPayload.service_id;
      delete legacyPayload.service_title;
      delete legacyPayload.service_description;
      delete legacyPayload.selected_availability_block_id;
      delete legacyPayload.requested_date;
      delete legacyPayload.requested_start_time;
      delete legacyPayload.requested_end_time;
      delete legacyPayload.timezone;
      delete legacyPayload.player_age_at_request;
      delete legacyPayload.current_team;
      const fallback = await supabase.from("conversation_private_details").insert(legacyPayload);
      privateDetailsError = fallback.error;
    }

    if (privateDetailsError) {
      console.error("[trainingRequests] Private conversation details creation failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        conversationId,
        error: privateDetailsError.message,
        code: privateDetailsError.code,
      });
    }

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_user_id: authData.user.id,
      sender_role: profile.role === "adult_player" ? "player" : "parent",
      body: firstMessage,
    });

    if (messageError) {
      console.error("[trainingRequests] Initial message creation failed", {
        userId: authData.user.id,
        coachId: requestedCoach.id,
        conversationId,
        error: messageError.message,
        code: messageError.code,
      });
    }

    const requestPayload = {
      coach_id: requestedCoach.id,
      coach_slug: requestedCoach.slug,
      conversation_id: conversationId,
      requester_user_id: authData.user.id,
      client_request_id: clientRequestId,
      service_id: selectedService?.id ?? null,
      service_title: selectedService?.title ?? null,
      service_description: selectedService?.description ?? null,
      selected_availability_block_id: selectedAvailability?.id ?? null,
      requested_date: finalRequestedDate || null,
      requested_start_time: finalRequestedStartTime || null,
      requested_end_time: finalRequestedEndTime || null,
      timezone: finalTimezone,
      name: accountProfile.playerName,
      email: authData.user.email ?? "",
      phone: privateDetails?.phone_e164 ?? null,
      player_age: playerAge,
      player_age_at_request: accountProfile.playerAgeAtRequest,
      current_level: currentLevel || null,
      training_goals: cleanString(payload.training_goals),
      preferred_location: preferredLocation || null,
      preferred_days_times: cleanString(payload.preferred_days_times) || null,
      message: cleanString(payload.message) || null,
      status: "pending",
      is_minor: isMinor,
      guardian_required: isMinor,
      guardian_name: accountProfile.guardianName || null,
      guardian_confirmed_at: guardianConfirmed ? now : null,
      updated_at: now,
    };
    let { data: requestRow, error: requestError } = await supabase
      .from("training_requests")
      .insert(requestPayload)
      .select("id")
      .single<{ id: string }>();

    if (requestError && isMissingColumnError(requestError)) {
      const legacyPayload: Record<string, unknown> = { ...requestPayload };
      delete legacyPayload.conversation_id;
      delete legacyPayload.requester_user_id;
      delete legacyPayload.client_request_id;
      delete legacyPayload.service_id;
      delete legacyPayload.service_title;
      delete legacyPayload.service_description;
      delete legacyPayload.selected_availability_block_id;
      delete legacyPayload.requested_date;
      delete legacyPayload.requested_start_time;
      delete legacyPayload.requested_end_time;
      delete legacyPayload.timezone;
      delete legacyPayload.player_age_at_request;
      delete legacyPayload.updated_at;
      const fallback = await supabase.from("training_requests").insert(legacyPayload).select("id").single<{ id: string }>();
      requestRow = fallback.data;
      requestError = fallback.error;
    }

    if (requestError || !requestRow) {
      console.error("[trainingRequests] Training request insert failed", {
        userId: authData.user.id,
        role: profile.role,
        coachId: requestedCoach.id,
        coachSlug,
        serviceId: selectedService?.id ?? null,
        selectedAvailabilityBlockId: selectedAvailability?.id ?? null,
        requestedDate: finalRequestedDate || null,
        error: requestError?.message,
        code: requestError?.code,
      });
      return jsonError("REQUEST_CREATE_FAILED", "We could not send this training request. Please try again.", 500);
    }

    const requestId = requestRow.id;
    const access = await getMessageAccess({ coach: requestedCoach, coachUserId: requestedCoach.user_id ?? null });
    const coachActionUrl = `/coach/messages/${conversationId}`;

    if (requestedCoach.user_id) {
      try {
        await createNotification({
          userId: requestedCoach.user_id,
          type: "new_training_request",
          title: access.hasAccess ? "New training request" : "New training request waiting",
          body: access.hasAccess
            ? `${accountProfile.playerName} sent a request in your Message Center.`
            : "Open your Message Center to view the request.",
          relatedConversationId: conversationId,
          actionUrl: coachActionUrl,
        });
        console.info("[trainingRequests] Coach notification created", {
          coachUserId: requestedCoach.user_id,
          conversationId,
          requestId,
        });
      } catch (notificationError) {
        console.error("[trainingRequests] Coach notification creation failed", {
          coachUserId: requestedCoach.user_id,
          conversationId,
          requestId,
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      }

      await sendPushNotificationToUser(requestedCoach.user_id, {
        title: access.hasAccess ? "New training request" : "New training request waiting",
        body: access.hasAccess
          ? "A new request is waiting in your Message Center."
          : "Open your Message Center to view the request.",
        url: coachActionUrl,
        tag: `conversation-${conversationId}`,
      });
    }

    if (!access.hasAccess && requestedCoach.email && !conversation.free_coach_alert_sent_at) {
      const attemptedAt = new Date().toISOString();
      await supabase
        .from("conversations")
        .update({ free_coach_alert_attempted_at: attemptedAt })
        .eq("id", conversationId)
        .is("free_coach_alert_sent_at", null);

      const result = await sendFreeCoachLockedRequestEmail({
        to: requestedCoach.email,
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

    console.info("[trainingRequests] Training request created", {
      userId: authData.user.id,
      coachId: requestedCoach.id,
      requestId,
      conversationId,
      status: "pending",
      calendarVisibleToPremiumCoach: access.hasAccess && Boolean(finalRequestedDate),
    });

    return NextResponse.json({ success: true, requestId, conversationId }, { status: 201 });
  } catch (error) {
    console.error("[trainingRequests] Unexpected request creation failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError("SERVER_ERROR", "Training requests are temporarily unavailable. Please try again.", 500);
  }
}
