import Link from "next/link";
import { redirect } from "next/navigation";
import { CoachShell } from "@/components/coach/CoachShell";
import {
  ClipForm,
  ClipGrid,
  FeedbackList,
  PassportBundleOverview,
  PassportHeader,
  ReportContentForm,
  secondaryButton,
} from "@/components/passport/PassportComponents";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { addCoachFeedbackAction, addDevelopmentFocusAction } from "@/lib/passportActions";
import { canCoachAccessPlayer, getPlayerPassportBundle } from "@/lib/passportData";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function CoachTeamPlayerPage({ params }: { params: Promise<{ teamId: string; playerId: string }> }) {
  const { teamId, playerId } = await params;
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  if (!(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
    redirect(`/coach/passport/teams/${teamId}?error=not-authorized`);
  }
  const [access, unreadCount, notificationCount, bundle] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getPlayerPassportBundle(playerId),
  ]);
  if (!bundle) {
    redirect(`/coach/passport/teams/${teamId}?error=player-not-found`);
  }
  const returnTo = `/coach/passport/teams/${teamId}/players/${playerId}`;

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Roster Player"
          title={bundle.profile.display_name}
          body={[bundle.profile.sport, bundle.profile.position, bundle.profile.current_team].filter(Boolean).join(" - ")}
          action={<Link href={`/coach/passport/teams/${teamId}/handoff?player=${playerId}`} className={secondaryButton}>Handoff summary</Link>}
        />
        <PassportBundleOverview bundle={bundle} />
        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-950">Coach feedback</h2>
            <form action={addCoachFeedbackAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <input type="hidden" name="player_profile_id" value={playerId} />
              <input type="hidden" name="team_id" value={teamId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="text-sm font-medium text-slate-800">
                Feedback type
                <select name="comment_type" className={inputClass}>
                  <option value="simple_comment">Simple comment</option>
                  <option value="technical_feedback">Technical feedback</option>
                  <option value="tactical_feedback">Tactical feedback</option>
                  <option value="mentality_confidence_note">Mentality/confidence note</option>
                  <option value="recommended_drill">Recommended drill</option>
                  <option value="strength_noticed">Strength noticed</option>
                  <option value="improvement_area">Improvement area</option>
                  <option value="handoff_note">Handoff note</option>
                </select>
              </label>
              <textarea name="body" rows={4} required placeholder="Keep it fast and useful." className={inputClass} />
              <div className="grid gap-4 sm:grid-cols-3">
                <input name="player_strength_observed" placeholder="Strength observed" className={inputClass} />
                <input name="improvement_area" placeholder="Improvement area" className={inputClass} />
                <input name="recommended_drill" placeholder="Recommended drill" className={inputClass} />
              </div>
              <select name="visibility" className={inputClass} defaultValue="player_parent">
                <option value="player_parent">Player + parent</option>
                <option value="connected_coaches">Connected coaches</option>
                <option value="shared_passport">Shared passport</option>
                <option value="internal_staff_only">Internal staff only</option>
              </select>
              <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">Add feedback</button>
            </form>
            <FeedbackList feedback={bundle.feedback} />
          </section>
          <aside className="space-y-4">
            <form action={addDevelopmentFocusAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <input type="hidden" name="player_profile_id" value={playerId} />
              <input type="hidden" name="team_id" value={teamId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <h2 className="text-lg font-semibold text-slate-950">Add focus area</h2>
              <input name="focus_area" required placeholder="Weak-foot passing, decision-making..." className={inputClass} />
              <textarea name="description" rows={3} placeholder="Short detail" className={inputClass} />
              <select name="priority" className={inputClass}>
                <option value="1">Priority 1</option>
                <option value="2">Priority 2</option>
                <option value="3">Priority 3</option>
              </select>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">Add focus</button>
            </form>
            <ClipForm playerId={playerId} teamId={teamId} returnTo={returnTo} source="coach_upload" />
            <ReportContentForm playerId={playerId} contentType="player_profile" contentId={playerId} returnTo={returnTo} reporterRole="coach" />
          </aside>
        </div>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-950">Private clips</h2>
          <ClipGrid clips={bundle.clips} />
        </section>
      </div>
    </CoachShell>
  );
}
