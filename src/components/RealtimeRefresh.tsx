"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function RealtimeRefresh({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId?: string;
}) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const refreshSoon = () => {
      if (timerRef.current) {
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        router.refresh();
      }, 250);
    };

    const channel = supabase
      .channel(`message-centre:${userId}:${conversationId ?? "list"}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const unreadCount = Number((payload.new as { unread_count?: number | string }).unread_count ?? 0);
          if (unreadCount > 0) {
            refreshSoon();
          }
        },
      );

    if (conversationId) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const senderUserId = (payload.new as { sender_user_id?: string | null }).sender_user_id;
          if (senderUserId !== userId) {
            refreshSoon();
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [conversationId, router, userId]);

  return null;
}
