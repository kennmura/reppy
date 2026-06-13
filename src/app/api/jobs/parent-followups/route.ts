import { NextResponse } from "next/server";
import { appUrl, sendPlatformEmail } from "@/lib/email";
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

  let sent = 0;
  for (const conversation of conversations ?? []) {
    const { data: details } = await supabase
      .from("conversation_private_details")
      .select("requester_email")
      .eq("conversation_id", conversation.id)
      .maybeSingle<{ requester_email: string | null }>();

    if (!details?.requester_email) {
      continue;
    }

    const search = new URLSearchParams();
    if (conversation.sport) {
      search.set("sport", conversation.sport.toLowerCase().replaceAll(" ", "-"));
    }
    if (conversation.general_location) {
      search.set("location", conversation.general_location);
    }

    await sendPlatformEmail({
      to: details.requester_email,
      subject: "No response to your training request yet",
      body: [
        "We have not received a response to your training request yet.",
        "",
        "You can keep this request open or explore other local coaches who may be a good fit.",
      ].join("\n"),
      ctaLabel: "Browse Other Coaches",
      ctaUrl: appUrl(`/coaches?${search.toString()}`),
    });

    await supabase
      .from("conversations")
      .update({ parent_follow_up_sent_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .is("parent_follow_up_sent_at", null);
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
