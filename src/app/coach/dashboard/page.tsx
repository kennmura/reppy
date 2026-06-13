import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachConversations, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, conversations] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
    getCoachConversations({ coachId: coach.id }),
  ]);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coach dashboard</h1>
          <p className="mt-2 text-slate-600">Manage training requests, billing, and players.</p>
        </div>
        <TrialBanner access={access} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Unread requests" value={unreadCount} />
          <Metric label="Total conversations" value={conversations.length} />
          <Metric label="Message access" value={access.hasAccess ? "Active" : "Locked"} />
        </div>
        <Link
          href="/coach/messages"
          className="inline-flex rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
        >
          Open Message Centre
        </Link>
      </div>
    </CoachShell>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
