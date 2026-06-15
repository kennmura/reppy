import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { PassportHeader, PassportMetric, PassportTeamCard, primaryButton, secondaryButton } from "@/components/passport/PassportComponents";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportDashboard } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachPassportPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, dashboard] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachPassportDashboard(user.id),
  ]);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Reppy Passport"
          title="Team development dashboard"
          body="Create teams, add rosters, capture coach feedback, and publish handoff summaries for the next coach."
          action={<Link href="/coach/passport/teams/new" className={primaryButton}>Create team</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <PassportMetric label="Teams" value={dashboard.teams.length} />
          <PassportMetric label="Roster players" value={dashboard.playerCount} />
          <PassportMetric label="Pending invites" value={dashboard.pendingInviteCount} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/coach/passport/teams" className={secondaryButton}>Open teams</Link>
          <Link href="/coach/passport/teams/new" className={secondaryButton}>New team</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.teams.map((team) => (
            <PassportTeamCard key={team.id} team={team} href={`/coach/passport/teams/${team.id}`} />
          ))}
        </div>
      </div>
    </CoachShell>
  );
}
