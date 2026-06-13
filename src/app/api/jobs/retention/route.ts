import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
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
    .lte("retention_expires_at", now)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deleted = 0;
  for (const conversation of conversations ?? []) {
    await supabase
      .from("messages")
      .update({ body: "[deleted by retention policy]", deleted_at: now })
      .eq("conversation_id", conversation.id)
      .is("deleted_at", null);

    await supabase.from("moderation_logs").insert({
      action: "retention_delete_messages",
      conversation_id: conversation.id,
      reason: "Unsaved conversation exceeded one-year retention period.",
    });

    deleted += 1;
  }

  return NextResponse.json({ ok: true, conversations_processed: deleted });
}
