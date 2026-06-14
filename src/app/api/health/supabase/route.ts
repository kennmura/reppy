import { NextResponse } from "next/server";
import { phoneVerificationBypassStatus } from "@/lib/accountConfig";
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
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002",
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
          "user_id, phone_e164, phone_verified_at, account_type, updated_at, otp_send_count, otp_verify_attempt_count, otp_last_sent_at, otp_window_started_at",
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
          "id, requester_user_id, coach_id, client_request_id, service_id, service_title, service_description, name, player_age, current_level, preferred_days_times",
          { count: "exact", head: true },
        ),
    ]);
    const accountColumnsReady = !profileColumnError && !privateColumnError && !preferenceColumnError;
    const requestSchemaReady = !idempotencyError && !requestColumnError;
    const authSchemaReady =
      !profileError && !credentialError && !preferenceError && !privateAccountError && requestSchemaReady && accountColumnsReady;

    return NextResponse.json({
      ...basePayload,
      configured: true,
      reachable: !schemaError,
      schemaReady: !schemaError && !notificationError && !participantError && authSchemaReady,
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
