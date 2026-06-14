import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import {
  getCoachAvailabilityBlocks,
  getCoachConversations,
  getCoachProfileByOwner,
  getCoachUnreadCount,
} from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, conversations, profile, availabilityBlocks] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachConversations({ coachId: coach.id, coachUserId }),
    getCoachProfileByOwner(user.id),
    getCoachAvailabilityBlocks(coach.id),
  ]);
  const checklist = buildProfileChecklist(profile, availabilityBlocks.length);
  const onboardingComplete = checklist.every((item) => item.done);

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
          {onboardingComplete ? (
            <AvailabilityUpdateCard availabilityBlocks={availabilityBlocks} />
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Next steps</h2>
              <div className="mt-4 grid gap-2">
                {checklist.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#12355b]/20 ${
                      item.done
                        ? "border-[#d7e5dc] bg-[#f3f8f5] text-[#2f6f5e] hover:border-[#2f6f5e]"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#12355b] hover:bg-white"
                    }`}
                  >
                    <span>
                      <span className="font-semibold">{item.done ? "Done: " : "To do: "}</span>
                      {item.label}
                    </span>
                    <span className="text-xs font-semibold text-[#12355b] group-hover:underline">
                      {item.done ? "Review" : "Finish"}
                    </span>
                  </Link>
                ))}
                {!access.hasAccess ? (
                  <Link
                    href="/coach/billing"
                    className="flex min-h-11 items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                  >
                    Start trial or upgrade to view full private requests and messages.
                  </Link>
                ) : null}
              </div>
            </section>
          )}
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

function buildProfileChecklist(
  profile: Awaited<ReturnType<typeof getCoachProfileByOwner>>,
  availabilityCount: number,
) {
  const coach = profile?.coach;
  return [
    { label: "Add profile photo", done: Boolean(coach?.profile_photo_url), href: "/coach/profile/edit#photos" },
    { label: "Add sport", done: Boolean(coach?.sport), href: "/coach/profile/edit#basics" },
    { label: "Add location", done: Boolean(coach?.location || coach?.zip_code), href: "/coach/profile/edit#basics" },
    { label: "Add services/pricing", done: Boolean(profile?.services.length), href: "/coach/profile/edit#services" },
    { label: "Add availability", done: availabilityCount > 0, href: "/coach/calendar" },
    {
      label: "Submit profile for review",
      done: ["pending_review", "published"].includes(coach?.profile_status ?? ""),
      href: "/coach/profile/edit#submit",
    },
  ];
}

function AvailabilityUpdateCard({
  availabilityBlocks,
}: {
  availabilityBlocks: Awaited<ReturnType<typeof getCoachAvailabilityBlocks>>;
}) {
  const upcoming = availabilityBlocks.slice(0, 4);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
        Availability
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">Update availability</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Keep available training hours fresh so players and parents know when to request sessions.
      </p>
      {upcoming.length ? (
        <div className="mt-4 grid gap-2">
          {upcoming.map((block) => (
            <div key={block.id} className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{formatDateLabel(block.availability_date)}</span>
              <span> - {formatTimeLabel(block.start_time)} to {formatTimeLabel(block.end_time)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          No availability blocks are saved yet.
        </p>
      )}
      <Link
        href="/coach/calendar"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#12355b] px-5 text-sm font-semibold text-white hover:bg-[#0d2948]"
      >
        Open Calendar
      </Link>
    </section>
  );
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
