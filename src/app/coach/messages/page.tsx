import { CoachShell } from "@/components/coach/CoachShell";
import { ConversationRow } from "@/components/coach/ConversationRow";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachConversations, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const sidebarFilters = ["inbox", "unread", "replied", "scheduled", "saved", "archived", "spam"];

export default async function CoachMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const params = await searchParams;
  const [access, unreadCount, conversations] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
    getCoachConversations({ coachId: coach.id, status: params.status }),
  ]);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="grid gap-4 xl:grid-cols-[180px_1fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {sidebarFilters.map((filter) => (
            <a
              key={filter}
              href={`/coach/messages${filter === "inbox" ? "" : `?status=${filter}`}`}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium capitalize text-slate-700 hover:bg-slate-50"
            >
              {filter}
              {filter === "unread" && unreadCount ? (
                <span className="rounded-full bg-[#12355b] px-2 py-0.5 text-xs text-white">
                  {unreadCount}
                </span>
              ) : null}
            </a>
          ))}
        </aside>
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Message Centre</h1>
            <p className="mt-1 text-sm text-slate-600">
              {unreadCount} unread training request{unreadCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-b border-slate-200 p-4">
            <TrialBanner access={access} />
          </div>
          {conversations.length ? (
            conversations.map((conversation) => (
              <ConversationRow key={conversation.id} conversation={conversation} access={access} />
            ))
          ) : (
            <div className="p-8 text-slate-600">No conversations yet.</div>
          )}
        </section>
      </div>
    </CoachShell>
  );
}
