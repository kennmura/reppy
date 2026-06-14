import { NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase";

export async function GET() {
  const configured = hasSupabaseConfig() && hasSupabaseAdminConfig();

  if (!configured) {
    return NextResponse.json({
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
    ] = await Promise.all([
      supabase.from("coaches").select("id", { count: "exact", head: true }),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
      supabase.from("conversation_participants").select("id", { count: "exact", head: true }),
      supabase.from("user_profiles").select("id", { count: "exact", head: true }),
      supabase.from("coach_credentials").select("id", { count: "exact", head: true }),
      supabase.from("user_coaching_preferences").select("user_id", { count: "exact", head: true }),
      supabase.from("account_private_details").select("user_id", { count: "exact", head: true }),
      supabase.from("training_requests").select("client_request_id", { count: "exact", head: true }),
    ]);
    const authSchemaReady =
      !profileError && !credentialError && !preferenceError && !privateAccountError && !idempotencyError;

    return NextResponse.json({
      configured: true,
      reachable: !schemaError,
      schemaReady: !schemaError && !notificationError && !participantError && authSchemaReady,
      authSchemaReady,
      realtimeReady: !notificationError && !participantError,
    });
  } catch {
    return NextResponse.json({
      configured: true,
      reachable: false,
      schemaReady: false,
      authSchemaReady: false,
      realtimeReady: false,
    });
  }
}
