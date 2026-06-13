import { notFound } from "next/navigation";
import {
  addConversationToPlayers,
  replyToConversation,
  toggleConversationSaved,
  updateConversationStatus,
} from "@/lib/actions";
import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachConversationThread, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const statuses = ["new", "replied", "scheduled", "completed", "declined", "archived", "spam"];

export default async function CoachMessageThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const { conversationId } = await params;
  const [access, unreadCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
  ]);
  const thread = await getCoachConversationThread({
    coachId: coach.id,
    conversationId,
    includePrivate: access.hasAccess,
  });

  if (!thread) {
    notFound();
  }

  if (!access.hasAccess) {
    return (
      <CoachShell unreadCount={unreadCount} access={access}>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            This training request is waiting for you.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Start your seven-day trial or upgrade to view the full request and respond.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <Meta label="Sport" value={thread.conversation.sport} />
            <Meta label="Player age range" value={thread.conversation.age_range} />
            <Meta label="General location" value={thread.conversation.general_location} />
          </div>
          <div className="mt-6">
            <TrialBanner access={access} />
          </div>
          <a
            href="/coach/billing"
            className="mt-4 inline-flex rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
          >
            View upgrade options
          </a>
        </div>
      </CoachShell>
    );
  }

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="space-y-4">
        <TrialBanner access={access} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {thread.privateDetails?.requester_display_name || "Training request"}
              </h1>
              <p className="mt-2 text-slate-600">
                {thread.conversation.sport} · Ages {thread.conversation.age_range} ·{" "}
                {thread.conversation.general_location}
              </p>
            </div>
            <form action={toggleConversationSaved}>
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
              <input type="hidden" name="is_saved" value={String(!thread.conversation.is_saved)} />
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                {thread.conversation.is_saved ? "Unsave" : "Save"}
              </button>
            </form>
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <Meta label="Current level" value={thread.privateDetails?.current_level} />
            <Meta label="Preferred days/times" value={thread.privateDetails?.preferred_days_times} />
            <Meta label="Guardian" value={thread.privateDetails?.guardian_name} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {thread.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {message.sender_role} · {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800">{message.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_260px]">
          <form action={replyToConversation} className="grid gap-3">
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
            <button className="w-fit rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white">
              Send reply
            </button>
          </form>
          <div className="space-y-3">
            <form action={updateConversationStatus} className="grid gap-2">
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
              <label className="text-sm font-medium text-slate-800">
                Status
                <select
                  name="status"
                  defaultValue={thread.conversation.status}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                Update status
              </button>
            </form>
            <form action={addConversationToPlayers}>
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
              <button className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                Add to My Players
              </button>
            </form>
          </div>
        </section>
      </div>
    </CoachShell>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value || "Not provided"}</p>
    </div>
  );
}
