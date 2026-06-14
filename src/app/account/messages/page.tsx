import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getAccountConversations } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountMessagesPage() {
  const user = await getAccountUserOrRedirect();
  const [notificationCount, conversations] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountConversations(user.id),
  ]);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <RealtimeRefresh userId={user.id} />
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Messages</h1>
          <p className="mt-1 text-sm text-slate-600">
            Requests and replies stay inside Reppy. Unsaved conversations are deleted 90 days after
            their most recent activity.
          </p>
        </div>
        {conversations.length ? (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/account/messages/${conversation.id}`}
              className="grid gap-2 border-b border-slate-200 p-4 last:border-b-0 hover:bg-slate-50 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-950">
                    {conversation.sport || "Training request"}
                  </h2>
                  {(conversation.participant_unread_count ?? 0) > 0 ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {conversation.participant_unread_count} unread
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {conversation.request_type || "Training"} -{" "}
                  {conversation.general_location || "Area not provided"}
                </p>
              </div>
              <p className="text-sm text-slate-500 sm:text-right">
                {new Date(conversation.last_message_at).toLocaleDateString()}
              </p>
            </Link>
          ))
        ) : (
          <div className="p-8 text-slate-600">No conversations yet.</div>
        )}
      </section>
    </AccountShell>
  );
}
