import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabaseAuth = await createSupabaseServerClient();
  const { data } = await supabaseAuth.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!data.user.email_confirmed_at) {
    return NextResponse.json({ error: "Email verification is required." }, { status: 403 });
  }

  const payload = await request.json();
  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
  const p256dh = typeof payload.keys?.p256dh === "string" ? payload.keys.p256dh : "";
  const authKey = typeof payload.keys?.auth === "string" ? payload.keys.auth : "";

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const userAgent = request.headers.get("user-agent");
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: data.user.id,
      endpoint,
      p256dh,
      auth_key: authKey,
      user_agent: userAgent,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("notification_preferences").upsert({
    user_id: data.user.id,
    push_enabled: true,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
