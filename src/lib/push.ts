import webpush, { type PushSubscription } from "web-push";
import { createSupabaseAdminClient } from "./supabase";

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

let configured = false;

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return true;
}

export function hasPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export async function sendPushNotificationToUser(userId: string | null | undefined, payload: PushPayload) {
  if (!userId || !configureWebPush()) {
    return { sent: 0, skipped: true };
  }

  const supabase = createSupabaseAdminClient();
  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle<{ push_enabled: boolean }>();

  if (preferences?.push_enabled === false) {
    return { sent: 0, skipped: true };
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  let sent = 0;
  for (const subscription of (subscriptions ?? []) as StoredPushSubscription[]) {
    const pushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      sent += 1;
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", subscription.id);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
      } else {
        await supabase.from("moderation_logs").insert({
          action: "push_delivery_failed",
          target_user_id: userId,
          reason: "Push delivery failed without exposing payload details.",
        });
      }
    }
  }

  return { sent };
}
