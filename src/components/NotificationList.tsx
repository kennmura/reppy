import Link from "next/link";
import { dismissNotification, markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import type { Notification } from "@/lib/types";

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">In-app alerts for requests, replies, billing, and safety updates.</p>
        </div>
        <form action={markAllNotificationsRead}>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Mark all read
          </button>
        </form>
      </div>
      {notifications.length ? (
        <div>
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-950">{notification.title}</h2>
                  {!notification.is_read ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      unread
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {notification.action_url ? (
                  <Link
                    href={notification.action_url}
                    className="rounded-md bg-[#12355b] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Open
                  </Link>
                ) : null}
                {!notification.is_read ? (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notification_id" value={notification.id} />
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                      Mark read
                    </button>
                  </form>
                ) : null}
                <form action={dismissNotification}>
                  <input type="hidden" name="notification_id" value={notification.id} />
                  <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                    Dismiss
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="p-8 text-slate-600">No notifications yet.</div>
      )}
    </section>
  );
}
