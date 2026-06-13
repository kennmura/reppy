import { NextResponse } from "next/server";
import { appUrl, sendPlatformEmail } from "@/lib/email";
import { getMessageAccess } from "@/lib/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { Coach } from "@/lib/types";

const requiredFields = ["name", "email", "player_age", "training_goals"] as const;

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

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== "string" || !payload[field].trim()) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
      }
    }

    const playerAge = cleanString(payload.player_age);
    const parsedAge = Number.parseInt(playerAge, 10);
    const isMinor = !Number.isNaN(parsedAge) && parsedAge < 18;
    const guardianConfirmed = payload.guardian_confirmed === true || payload.guardian_confirmed === "on";

    if (isMinor && !guardianConfirmed) {
      return NextResponse.json({ error: "Guardian confirmation is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: coach } = await supabase
      .from("coaches")
      .select("*")
      .eq("slug", payload.coach_slug ?? "ken-murakawa")
      .maybeSingle<Coach>();

    if (!coach) {
      return NextResponse.json({ error: "Coach not found." }, { status: 404 });
    }

    const now = new Date();
    const retentionExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const sport = coach.sport || "Training";
    const location = generalArea(cleanString(payload.preferred_location) || coach.location || "");
    const requestType = cleanString(payload.current_level) || coach.category || "Training request";
    const firstMessage = [
      `Training goals: ${cleanString(payload.training_goals)}`,
      cleanString(payload.message) ? `Message: ${cleanString(payload.message)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        coach_id: coach.id,
        coach_user_id: coach.user_id ?? null,
        requester_user_id: null,
        guardian_user_id: null,
        sport,
        request_type: requestType,
        age_range: ageRange(playerAge),
        general_location: location,
        status: "new",
        is_unread_by_coach: true,
        retention_expires_at: retentionExpiresAt.toISOString(),
        last_message_at: now.toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message ?? "Could not create conversation." },
        { status: 500 },
      );
    }

    const [{ error: privateDetailsError }, { error: messageError }, { error: requestError }] =
      await Promise.all([
        supabase.from("conversation_private_details").insert({
          conversation_id: conversation.id,
          requester_display_name: cleanString(payload.name),
          requester_email: cleanString(payload.email),
          requester_phone: cleanString(payload.phone) || null,
          guardian_name: cleanString(payload.guardian_name) || null,
          guardian_email: null,
          guardian_phone: null,
          exact_location: cleanString(payload.preferred_location) || null,
          preferred_days_times: cleanString(payload.preferred_days_times) || null,
          current_level: cleanString(payload.current_level) || null,
        }),
        supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_user_id: null,
          sender_role: "parent",
          body: firstMessage,
        }),
        supabase.from("training_requests").insert({
          coach_id: coach.id,
          coach_slug: coach.slug,
          conversation_id: conversation.id,
          name: cleanString(payload.name),
          email: cleanString(payload.email),
          phone: cleanString(payload.phone) || null,
          player_age: playerAge,
          current_level: cleanString(payload.current_level) || null,
          training_goals: cleanString(payload.training_goals),
          preferred_location: cleanString(payload.preferred_location) || null,
          preferred_days_times: cleanString(payload.preferred_days_times) || null,
          message: cleanString(payload.message) || null,
          status: "new",
          is_minor: isMinor,
          guardian_required: isMinor,
          guardian_name: cleanString(payload.guardian_name) || null,
          guardian_confirmed_at: guardianConfirmed ? now.toISOString() : null,
        }),
      ]);

    const writeError = privateDetailsError || messageError || requestError;
    if (writeError) {
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    const access = await getMessageAccess({ coach, coachUserId: coach.user_id ?? null });
    if (coach.email) {
      await sendPlatformEmail({
        to: coach.email,
        subject: access.hasAccess
          ? "You received a new training request"
          : "You have a new training request waiting",
        body: access.hasAccess
          ? "A new training request is waiting in your Message Centre."
          : [
              "A new training request has arrived in your Message Centre.",
              "",
              `Player age range: ${ageRange(playerAge)}`,
              `General area: ${location}`,
              `Training category: ${requestType}`,
              "",
              "Upgrade or start your free trial to view the complete request and respond.",
            ].join("\n"),
        ctaLabel: access.hasAccess ? "View Request" : "Open Message Centre",
        ctaUrl: appUrl(`/coach/messages/${conversation.id}`),
      });
    }

    return NextResponse.json({ ok: true, conversation_id: conversation.id });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
