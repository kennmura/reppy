"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function NotificationBell({
  userId,
  initialCount,
  href,
}: {
  userId: string;
  initialCount: number;
  href: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_read", false)
            .then(({ count }) => setCount(count ?? 0));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href={href}
      aria-label="Notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-slate-500"
    >
      <Bell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-[#12355b] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
