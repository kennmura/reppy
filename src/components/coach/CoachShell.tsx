import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { signOutCoach } from "@/lib/actions";
import type { MessageAccess } from "@/lib/types";
import { CoachSidebarNav } from "./CoachSidebarNav";

export function CoachShell({
  children,
  userId,
  unreadCount,
  notificationCount,
  access,
}: {
  children: React.ReactNode;
  userId: string;
  unreadCount: number;
  notificationCount: number;
  access: MessageAccess;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/coach/dashboard" className="text-lg font-semibold text-slate-950">
            Coach Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} initialCount={notificationCount} href="/coach/notifications" />
            <form action={signOutCoach}>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-500">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <CoachSidebarNav unreadCount={unreadCount} />
          <div className="mt-4 rounded-md bg-[#f7f8f3] p-3 text-xs leading-5 text-slate-600">
            <p className="font-semibold text-slate-950">
              {access.hasAccess ? "Messaging active" : "Message Center locked"}
            </p>
            <p className="mt-1">
              {access.hasAccess
                ? "You can view and reply to full training requests."
                : "Start a trial or upgrade to view complete requests and reply."}
            </p>
          </div>
          <form action={signOutCoach} className="mt-4">
            <button className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-500">
              Sign out
            </button>
          </form>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
