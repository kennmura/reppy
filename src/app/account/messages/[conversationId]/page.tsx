import { notFound } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { replyToConversationAsAccount } from "@/lib/actions";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getAccountConversationThread } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountMessageThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const user = await getAccountUserOrRedirect();
  const { conversationId } = await params;
  const [notificationCount, thread] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountConversationThread({ userId: user.id, conversationId }),
  ]);

  if (!thread) {
    notFound();
  }

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <RealtimeRefresh userId={user.id} conversationId={conversationId} />
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {thread.conversation.sport || "Training request"}
          </h1>
          <p className="mt-2 text-slate-600">
            {thread.conversation.request_type || "Training"} -{" "}
            {thread.conversation.general_location || "Area not provided"}
          </p>
          <p className="mt-4 rounded-md bg-[#f7f8f3] px-4 py-3 text-sm leading-6 text-slate-700">
            Normal conversation activity stays inside Reppy. Push notifications use generic text
            and do not include full private messages.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {thread.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {message.sender_role} - {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800">{message.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <form action={replyToConversationAsAccount} className="grid gap-3">
            <input type="hidden" name="conversation_id" value={thread.conversation.id} />
            <label className="text-sm font-medium text-slate-800">
              Reply
              <textarea
                name="body"
                required
                rows={5}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <PendingSubmitButton
              idleLabel="Send reply"
              pendingLabel="Sending..."
              className="w-fit rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
        </section>
      </div>
    </AccountShell>
  );
}
