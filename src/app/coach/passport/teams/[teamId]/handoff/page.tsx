import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/CoachShell";
import { PassportHeader, secondaryButton } from "@/components/passport/PassportComponents";
import { generateHandoffDraftAction, saveHandoffSummaryAction } from "@/lib/passportActions";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPassportTeamBundle, getPlayerPassportBundle } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function TeamHandoffPage({
  params,
  searchParams,
}: { params: Promise<{ teamId: string }>; searchParams: Promise<{ player?: string | string[] }> }) {
  const { teamId } = await params;
  const query = await searchParams;
  const selectedPlayerId = typeof query.player === "string" ? query.player : "";
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
  const selectedPlayer = selectedPlayerId
    ? teamBundle.players.find((player) => player.id === selectedPlayerId)
    : teamBundle.players[0];
  const bundle = selectedPlayer ? await getPlayerPassportBundle(selectedPlayer.id) : null;
  const returnTo = `/coach/passport/teams/${teamId}/handoff${selectedPlayer ? `?player=${selectedPlayer.id}` : ""}`;

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Handoff Summaries"
          title={`${teamBundle.team.name} handoff`}
          body="Write a handoff manually or generate a simple draft from stored feedback and focus areas."
          action={<Link href={`/coach/passport/teams/${teamId}`} className={secondaryButton}>Team overview</Link>}
        />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Choose player</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {teamBundle.players.map((player) => (
              <Link
                key={player.id}
                href={`/coach/passport/teams/${teamId}/handoff?player=${player.id}`}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  selectedPlayer?.id === player.id ? "border-[#12355b] bg-[#12355b] text-white" : "border-slate-300 text-slate-700"
                }`}
              >
                {player.display_name}
              </Link>
            ))}
          </div>
        </section>
        {selectedPlayer ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
            <form action={saveHandoffSummaryAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <input type="hidden" name="player_profile_id" value={selectedPlayer.id} />
              <input type="hidden" name="team_id" value={teamId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="summary_mode" value="manual" />
              <h2 className="text-lg font-semibold text-slate-950">Write handoff summary</h2>
              <textarea name="strengths" rows={3} placeholder="Strengths" className={inputClass} />
              <textarea name="improvement_areas" rows={3} placeholder="Improvement areas" className={inputClass} />
              <textarea name="recommended_focus" rows={3} placeholder="Recommended focus" className={inputClass} />
              <textarea name="coach_summary" rows={4} placeholder="Coach summary" className={inputClass} />
              <textarea name="next_season_notes" rows={3} placeholder="Next season notes" className={inputClass} />
              <textarea name="internal_staff_notes" rows={3} placeholder="Internal staff notes, hidden from player/public" className={inputClass} />
              <select name="visibility" className={inputClass} defaultValue="shared_passport">
                <option value="shared_passport">Shared passport</option>
                <option value="connected_coaches">Connected coaches</option>
                <option value="player_parent">Player + parent</option>
                <option value="internal_staff_only">Internal staff only</option>
              </select>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button name="status" value="draft" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">Save draft</button>
                <button name="status" value="published" className="rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]">Publish</button>
              </div>
            </form>
            <aside className="space-y-4">
              <form action={generateHandoffDraftAction} className="rounded-lg border border-[#d7e5dc] bg-[#f3f8f5] p-5 shadow-sm">
                <input type="hidden" name="player_profile_id" value={selectedPlayer.id} />
                <input type="hidden" name="team_id" value={teamId} />
                <input type="hidden" name="return_to" value={returnTo} />
                <h2 className="text-lg font-semibold text-slate-950">Generate simple draft</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Uses saved feedback and focus areas. The coach must edit before publishing.
                </p>
                <button className="mt-4 rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]">Generate draft</button>
              </form>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Existing summaries</h2>
                <div className="mt-4 grid gap-3">
                  {(bundle?.handoffs ?? []).map((handoff) => (
                    <article key={handoff.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <p className="font-semibold capitalize text-slate-950">{handoff.status} - {handoff.summary_mode.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-slate-600">{handoff.coach_summary || "No summary text."}</p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </CoachShell>
  );
}
