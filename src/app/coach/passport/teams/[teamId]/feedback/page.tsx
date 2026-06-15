import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/CoachShell";
import { FeedbackList, PassportHeader, secondaryButton } from "@/components/passport/PassportComponents";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportTeamBundle, getPlayerPassportBundle } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function TeamFeedbackPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, teamBundle] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachPassportTeamBundle(teamId, user.id),
  ]);
  if (!teamBundle) {
    redirect("/coach/passport/teams?error=team-not-found");
  }
  const playerBundles = await Promise.all(teamBundle.players.map((player) => getPlayerPassportBundle(player.id)));
  const feedback = playerBundles.flatMap((bundle) => bundle?.feedback.filter((item) => item.team_id === teamId) ?? []);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Team Feedback"
          title={`${teamBundle.team.name} feedback`}
          body="Fast feedback notes across this roster."
          action={<Link href={`/coach/passport/teams/${teamId}`} className={secondaryButton}>Team overview</Link>}
        />
        <FeedbackList feedback={feedback} />
      </div>
    </CoachShell>
  );
}
