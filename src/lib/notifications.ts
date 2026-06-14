import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "./supabase";
import type { Notification, NotificationType } from "./types";

export type CreateNotificationInput = {
  userId: string | null | undefined;
  type: NotificationType;
  title: string;
  body: string;
  relatedConversationId?: string | null;
  actionUrl?: string | null;
};

export async function createNotification({
  userId,
  type,
  title,
  body,
  relatedConversationId = null,
  actionUrl = null,
}: CreateNotificationInput) {
  if (!userId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      body,
      related_conversation_id: relatedConversationId,
      action_url: actionUrl,
      is_read: false,
    })
    .select("*")
    .single<Notification>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserNotifications(userId: string, limit = 50) {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount(userId: string) {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationReadForUser({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsReadForUser(userId: string) {
  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw error;
  }
}

export async function deleteNotificationForUser({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
