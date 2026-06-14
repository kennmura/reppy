import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("is_saved", false)
    .is("retention_processed_at", null)
    .or(`legal_hold_until.is.null,legal_hold_until.lt.${now}`)
    .lte("retention_expires_at", now)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  for (const conversation of conversations ?? []) {
    const { count: openReportCount } = await supabase
      .from("message_reports")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .in("status", ["new", "reviewing", "open"]);

    if ((openReportCount ?? 0) > 0) {
      continue;
    }

    await supabase
      .from("messages")
      .update({ body: "[deleted by retention policy]", deleted_at: now })
      .eq("conversation_id", conversation.id)
      .is("deleted_at", null);

    await supabase.from("conversation_private_details").delete().eq("conversation_id", conversation.id);
    await supabase.from("contact_share_events").delete().eq("conversation_id", conversation.id);
    await supabase.from("notifications").delete().eq("related_conversation_id", conversation.id);
    await supabase
      .from("conversations")
      .update({
        retention_processed_at: now,
        updated_at: now,
      })
      .eq("id", conversation.id)
      .is("retention_processed_at", null);

    await supabase.from("moderation_logs").insert({
      action: "retention_processed",
      conversation_id: conversation.id,
      reason: "Unsaved conversation exceeded 90-day retention period.",
    });

    processed += 1;
  }

  return NextResponse.json({ ok: true, conversations_processed: processed });
}
