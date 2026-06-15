import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/CoachShell";
import { PassportHeader, secondaryButton } from "@/components/passport/PassportComponents";
import { RosterCsvPreview } from "@/components/passport/RosterCsvPreview";
import { addRosterPlayerAction } from "@/lib/passportActions";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportTeamBundle } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function PassportTeamRosterPage({ params }: { params: Promise<{ teamId: string }> }) {
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
  const returnTo = `/coach/passport/teams/${teamId}/roster`;

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Roster"
          title={`${bundle.team.name} roster`}
          body="Add players with school email, personal email, or parent email. Emails stay private."
          action={<Link href={`/coach/passport/teams/${teamId}`} className={secondaryButton}>Team overview</Link>}
        />
        <form action={addRosterPlayerAction} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="team_id" value={teamId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <h2 className="text-lg font-semibold text-slate-950">Add roster player</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Player name" required><input name="player_name" required className={inputClass} /></Label>
            <Label text="Parent email"><input name="parent_email" type="email" className={inputClass} /></Label>
            <Label text="Player school email"><input name="player_school_email" type="email" className={inputClass} /></Label>
            <Label text="Player personal email"><input name="player_personal_email" type="email" className={inputClass} /></Label>
            <Label text="Position"><input name="position" className={inputClass} /></Label>
            <Label text="Jersey number"><input name="jersey_number" className={inputClass} /></Label>
            <Label text="Graduation year"><input name="graduation_year" type="number" min="2020" max="2045" className={inputClass} /></Label>
            <Label text="Height"><input name="height" className={inputClass} /></Label>
          </div>
          <Label text="Coach-only notes"><textarea name="coach_notes" rows={3} className={inputClass} /></Label>
          <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">Add player</button>
        </form>
        <RosterCsvPreview teamId={teamId} returnTo={returnTo} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Players</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {bundle.players.map((player) => (
              <Link key={player.id} href={`/coach/passport/teams/${teamId}/players/${player.id}`} className="grid gap-1 py-3 hover:text-[#12355b]">
                <span className="font-semibold text-slate-950">{player.display_name}</span>
                <span className="text-sm text-slate-600">{player.position || "No position"} - {player.graduation_year || "Grad year not set"}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Invites</h2>
          <p className="mt-2 text-sm text-slate-600">Team join code: <span className="font-semibold text-slate-950">{bundle.team.join_code}</span></p>
          <div className="mt-4 divide-y divide-slate-200">
            {bundle.invites.map((invite) => (
              <div key={invite.id} className="py-3 text-sm">
                <p className="font-semibold text-slate-950">{invite.player_name}</p>
                <p className="text-slate-600">{invite.status} - {invite.parent_email_normalized || invite.player_school_email_normalized || invite.player_personal_email_normalized}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </CoachShell>
  );
}

function Label({ text, required, children }: { text: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {text}
      {required ? <span className="text-red-600"> *</span> : null}
      {children}
    </label>
  );
}
