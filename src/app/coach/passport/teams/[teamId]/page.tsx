import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/CoachShell";
import { PassportHeader, PassportMetric, secondaryButton } from "@/components/passport/PassportComponents";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportTeamBundle } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PassportTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, bundle] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachPassportTeamBundle(teamId, user.id),
  ]);
  if (!bundle) {
    redirect("/coach/passport/teams?error=team-not-found");
  }

  const playerMembers = bundle.members.filter((member) => member.member_role === "player");

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Team Passport"
          title={bundle.team.name}
          body={[bundle.team.sport, bundle.team.season_name, bundle.team.age_group].filter(Boolean).join(" - ")}
          action={<Link href={`/coach/passport/teams/${teamId}/roster`} className={secondaryButton}>Manage roster</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <PassportMetric label="Players" value={playerMembers.length} />
          <PassportMetric label="Invites" value={bundle.invites.length} />
          <PassportMetric label="Join code" value={bundle.team.join_code} />
          <PassportMetric label="Status" value={bundle.team.status} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href={`/coach/passport/teams/${teamId}/roster`} className={secondaryButton}>Roster</Link>
          <Link href={`/coach/passport/teams/${teamId}/feedback`} className={secondaryButton}>Feedback</Link>
          <Link href={`/coach/passport/teams/${teamId}/handoff`} className={secondaryButton}>Handoff</Link>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Roster</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {bundle.players.map((player) => (
              <Link key={player.id} href={`/coach/passport/teams/${teamId}/players/${player.id}`} className="grid gap-1 py-3 hover:text-[#12355b]">
                <span className="font-semibold text-slate-950">{player.display_name}</span>
                <span className="text-sm capitalize text-slate-600">
                  {[player.position, player.graduation_year ? `Class of ${player.graduation_year}` : null].filter(Boolean).join(" - ")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </CoachShell>
  );
}
