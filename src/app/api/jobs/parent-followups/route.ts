import { NextResponse } from "next/server";
import { sendPushNotificationToUser } from "@/lib/push";
import { sportFromSlug, sportToSlug } from "@/lib/sports";
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
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, sport, general_location")
    .lte("created_at", cutoff)
    .is("parent_follow_up_sent_at", null)
    .neq("status", "replied")
    .neq("status", "scheduled")
    .neq("status", "completed")
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;
  for (const conversation of conversations ?? []) {
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversation.id)
      .in("role", ["parent", "player", "guardian"]);

    const search = new URLSearchParams();
    const sport = sportFromSlug(conversation.sport);
    if (sport) {
      search.set("sport", sportToSlug(sport));
    }
    if (conversation.general_location) {
      search.set("location", conversation.general_location);
    }

    const actionUrl = `/coaches?${search.toString()}`;

    for (const participant of participants ?? []) {
      if (!participant.user_id) {
        continue;
      }

      await supabase.from("notifications").insert({
        user_id: participant.user_id,
        type: "request_unanswered",
        title: "Your coach has not responded yet",
        body: "You can keep the request open or explore other local coaches.",
        related_conversation_id: conversation.id,
        action_url: actionUrl,
        is_read: false,
      });

      await sendPushNotificationToUser(participant.user_id, {
        title: "Your coach has not responded yet",
        body: "You can keep the request open or explore other local coaches.",
        url: actionUrl,
        tag: `request-unanswered-${conversation.id}`,
      });

      notified += 1;
    }

    await supabase
      .from("conversations")
      .update({ parent_follow_up_sent_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .is("parent_follow_up_sent_at", null);
  }

  return NextResponse.json({ ok: true, notified });
}
