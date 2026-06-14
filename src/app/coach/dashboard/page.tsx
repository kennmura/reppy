import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachConversations, getCoachProfileByOwner, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, conversations, profile] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachConversations({ coachId: coach.id, coachUserId }),
    getCoachProfileByOwner(user.id),
  ]);
  const checklist = buildProfileChecklist(profile);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coach Dashboard</h1>
          <p className="mt-2 text-slate-600">See what needs attention across your profile, requests, and messages.</p>
        </div>
        <TrialBanner access={access} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Profile completion" value={`${profile?.coach.profile_completion ?? 0}%`} />
          <Metric label="Profile status" value={coach.profile_status?.replaceAll("_", " ") ?? "draft"} />
          <Metric label="Unread requests" value={unreadCount} />
          <Metric label="Total conversations" value={conversations.length} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/coach/profile/edit"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            Edit Profile
          </Link>
          <Link
            href="/coach/profile/preview"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
          >
            Preview Public Profile
          </Link>
          <Link
            href="/coach/messages"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
          >
            Open Message Center
          </Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Next steps</h2>
            <div className="mt-4 grid gap-2">
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    item.done
                      ? "border-[#d7e5dc] bg-[#f3f8f5] text-[#2f6f5e]"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {item.done ? "Done: " : "To do: "}
                  {item.label}
                </div>
              ))}
              {!access.hasAccess ? (
                <Link
                  href="/coach/billing"
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                >
                  Start trial or upgrade to view full private requests and messages.
                </Link>
              ) : null}
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Recent conversations</h2>
            {conversations.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {conversations.slice(0, 5).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/coach/messages/${conversation.id}`}
                    className="grid gap-1 py-3 hover:text-[#12355b]"
                  >
                    <span className="font-semibold text-slate-950">
                      {conversation.sport || "Training request"}
                    </span>
                    <span className="text-sm text-slate-600">
                      {conversation.request_type || "Request"} -{" "}
                      {conversation.general_location || "Area not provided"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                New training requests and Message Center conversations will appear here.
              </p>
            )}
          </section>
        </div>
      </div>
    </CoachShell>
  );
}

function buildProfileChecklist(profile: Awaited<ReturnType<typeof getCoachProfileByOwner>>) {
  const coach = profile?.coach;
  return [
    { label: "Add profile photo", done: Boolean(coach?.profile_photo_url) },
    { label: "Add sport", done: Boolean(coach?.sport) },
    { label: "Add location", done: Boolean(coach?.location || coach?.zip_code) },
    { label: "Add services/pricing", done: Boolean(profile?.services.length || coach?.pricing_text) },
    { label: "Add availability", done: Boolean(coach?.general_availability) },
    { label: "Submit profile for review", done: ["pending_review", "published"].includes(coach?.profile_status ?? "") },
  ];
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
