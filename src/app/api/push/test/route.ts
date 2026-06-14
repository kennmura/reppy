import { NextResponse } from "next/server";
import { sendPushNotificationToUser } from "@/lib/push";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || !adminEmail || data.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await sendPushNotificationToUser(data.user.id, {
    title: "Reppy notifications are enabled",
    body: "You will receive generic alerts for Message Center activity.",
    url: "/coach/notifications",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true, result });
}
