import { NextResponse } from "next/server";
import { phoneVerificationBypassStatus } from "@/lib/accountConfig";
import { optionalAppBaseUrl } from "@/lib/appUrl";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
  hasSupabasePublicConfig,
} from "@/lib/supabase";

export async function GET() {
  const publicConfig = hasSupabasePublicConfig();
  const adminConfig = hasSupabaseAdminConfig();
  const configured = hasSupabaseConfig() && adminConfig;
  const basePayload = {
    publicConfig,
    adminConfig,
    phoneVerificationBypass: phoneVerificationBypassStatus(),
    appUrl: optionalAppBaseUrl(),
  };

  if (!configured) {
    return NextResponse.json({
      ...basePayload,
      configured: false,
      reachable: false,
      schemaReady: false,
      authSchemaReady: false,
      realtimeReady: false,
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const [
      { error: schemaError },
      { error: notificationError },
      { error: participantError },
      { error: profileError },
      { error: credentialError },
      { error: preferenceError },
      { error: privateAccountError },
      { error: idempotencyError },
      { error: profileColumnError },
      { error: privateColumnError },
      { error: preferenceColumnError },
      { error: requestColumnError },
      { error: coachLocationColumnError },
      { error: availabilityError },
      { error: availabilityColumnError },
    ] = await Promise.all([
      supabase.from("coaches").select("id", { count: "exact", head: true }),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase.from("conversation_participants").select("id", { count: "exact", head: true }),
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("coach_credentials").select("id", { count: "exact", head: true }),
      supabase.from("user_coaching_preferences").select("user_id", { count: "exact", head: true }),
      supabase.from("account_private_details").select("user_id", { count: "exact", head: true }),
      supabase.from("training_requests").select("client_request_id", { count: "exact", head: true }),
      supabase
        .from("user_profiles")
        .select("id, role, display_name, account_status, email_verified_at, phone_verified_at, updated_at", {
          count: "exact",
          head: true,
        }),
      supabase
        .from("account_private_details")
        .select(
          "user_id, phone_e164, phone_verified_at, player_date_of_birth, account_type, updated_at, otp_send_count, otp_verify_attempt_count, otp_last_sent_at, otp_window_started_at",
          { count: "exact", head: true },
        ),
      supabase
        .from("user_coaching_preferences")
        .select(
          "user_id, player_name, guardian_name, player_age, player_birth_date, current_team, contact_notes, location_text, skill_level, position, training_goals, preferred_days",
          { count: "exact", head: true },
        ),
      supabase
        .from("training_requests")
        .select(
          "id, requester_user_id, coach_id, client_request_id, service_id, service_title, service_description, selected_availability_block_id, requested_date, requested_start_time, requested_end_time, timezone, player_age_at_request, name, player_age, current_level, preferred_days_times, status, updated_at",
          { count: "exact", head: true },
        ),
      supabase
        .from("coaches")
        .select("id, city, state, zip_code, latitude, longitude, timezone", { count: "exact", head: true }),
      supabase.from("coach_availability_blocks").select("id", { count: "exact", head: true }),
      supabase
        .from("coach_availability_blocks")
        .select("id, coach_id, coach_user_id, availability_date, start_time, end_time, timezone, note, updated_at", {
          count: "exact",
          head: true,
        }),
    ]);
    const accountColumnsReady = !profileColumnError && !privateColumnError && !preferenceColumnError;
    const requestSchemaReady = !idempotencyError && !requestColumnError;
    const availabilitySchemaReady = !availabilityError && !availabilityColumnError;
    const coachLocationSchemaReady = !coachLocationColumnError;
    const authSchemaReady =
      !profileError && !credentialError && !preferenceError && !privateAccountError && requestSchemaReady && accountColumnsReady;

    return NextResponse.json({
      ...basePayload,
      configured: true,
      reachable: !schemaError,
      schemaReady:
        !schemaError &&
        !notificationError &&
        !participantError &&
        authSchemaReady &&
        availabilitySchemaReady &&
        coachLocationSchemaReady,
      authSchemaReady,
      realtimeReady: !notificationError && !participantError,
      checks: {
        userProfilesTable: !profileError,
        accountPrivateDetailsTable: !privateAccountError,
        userProfilesRequiredColumns: !profileColumnError,
        accountPrivateDetailsRequiredColumns: !privateColumnError,
        playerProfileRequiredColumns: !preferenceColumnError,
        trainingRequestRequiredColumns: !requestColumnError,
        trainingRequestIdempotencyColumn: !idempotencyError,
        coachLocationRequiredColumns: !coachLocationColumnError,
        coachAvailabilityTable: !availabilityError,
        coachAvailabilityRequiredColumns: !availabilityColumnError,
      },
    });
  } catch {
    return NextResponse.json({
      ...basePayload,
      configured: true,
      reachable: false,
      schemaReady: false,
      authSchemaReady: false,
      realtimeReady: false,
    });
  }
}
