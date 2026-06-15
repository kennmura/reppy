import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { PassportEmptyState, PassportHeader, PassportTeamCard, primaryButton } from "@/components/passport/PassportComponents";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportDashboard } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachPassportTeamsPage() {
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
          eyebrow="Teams"
          title="Passport teams"
          body="Manage high school, club, and training-group rosters."
          action={<Link href="/coach/passport/teams/new" className={primaryButton}>Create team</Link>}
        />
        {dashboard.teams.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.teams.map((team) => (
              <PassportTeamCard key={team.id} team={team} href={`/coach/passport/teams/${team.id}`} />
            ))}
          </div>
        ) : (
          <PassportEmptyState title="No teams yet" body="Create your first Passport team to start building development records." href="/coach/passport/teams/new" label="Create team" />
        )}
      </div>
    </CoachShell>
  );
}
