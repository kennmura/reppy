import { CoachShell } from "@/components/coach/CoachShell";
import { PassportHeader, primaryButton } from "@/components/passport/PassportComponents";
import { createPassportTeamAction } from "@/lib/passportActions";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getMessageAccess } from "@/lib/entitlements";
import { getCoachUnreadCount } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function NewPassportTeamPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="New Team"
          title="Create a Passport team"
          body="Start with soccer or basketball. You can add roster players manually or by CSV after creating the team."
        />
        <form action={createPassportTeamAction} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="return_to" value="/coach/passport/teams/new" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Team name" required>
              <input name="name" required className={inputClass} />
            </Label>
            <Label text="Sport" required>
              <select name="sport" className={inputClass} defaultValue="soccer">
                <option value="soccer">Soccer</option>
                <option value="basketball">Basketball</option>
              </select>
            </Label>
            <Label text="Team type">
              <select name="team_type" className={inputClass} defaultValue="high_school">
                <option value="high_school">High school</option>
                <option value="club">Club</option>
                <option value="private_training_group">Private training group</option>
                <option value="other">Other</option>
              </select>
            </Label>
            <Label text="Season name">
              <input name="season_name" placeholder="Fall 2026" className={inputClass} />
            </Label>
            <Label text="Age group">
              <input name="age_group" placeholder="Varsity, JV, U14" className={inputClass} />
            </Label>
            <Label text="School or club">
              <input name="school_or_club" className={inputClass} />
            </Label>
            <Label text="City">
              <input name="city" className={inputClass} />
            </Label>
            <Label text="State">
              <input name="state" className={inputClass} />
            </Label>
          </div>
          <button className={primaryButton}>Create team</button>
        </form>
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
