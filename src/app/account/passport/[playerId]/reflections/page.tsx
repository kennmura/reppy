import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PassportEmptyState, PassportHeader, primaryButton } from "@/components/passport/PassportComponents";
import { addGameReflectionAction } from "@/lib/passportActions";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function PassportReflectionsPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const { user } = await getAccountContextOrRedirect();
  if (!(await canManagePlayerProfile(user.id, playerId))) {
    redirect("/account/passport?error=not-authorized");
  }
  const [notificationCount, bundle] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getPlayerPassportBundle(playerId),
  ]);
  if (!bundle) {
    redirect("/account/passport?error=not-found");
  }

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Game Reflections"
          title={`${bundle.profile.display_name} reflections`}
          body="Simple post-game reflection that connected coaches can read and comment on."
        />
        <form action={addGameReflectionAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="player_profile_id" value={playerId} />
          <input type="hidden" name="return_to" value={`/account/passport/${playerId}/reflections`} />
          <label className="text-sm font-medium text-slate-800">
            Game date
            <input name="game_date" type="date" className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-800">
            What did I do well?
            <textarea name="did_well" rows={3} required className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-800">
            What did I struggle with?
            <textarea name="struggled_with" rows={3} required className={inputClass} />
          </label>
          <label className="text-sm font-medium text-slate-800">
            What is one thing I need to improve?
            <textarea name="improvement_focus" rows={3} required className={inputClass} />
          </label>
          <button className={primaryButton}>Save reflection</button>
        </form>
        {bundle.reflections.length ? (
          <div className="grid gap-3">
            {bundle.reflections.map((reflection) => (
              <article key={reflection.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-[#2f6f5e]">{reflection.game_date || "Game reflection"}</p>
                <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700">
                  <p><span className="font-semibold text-slate-950">Did well:</span> {reflection.did_well}</p>
                  <p><span className="font-semibold text-slate-950">Struggled with:</span> {reflection.struggled_with}</p>
                  <p><span className="font-semibold text-slate-950">Improve:</span> {reflection.improvement_focus}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <PassportEmptyState title="No reflections yet" body="After a game, add a short reflection so coaches can see how the player thinks about development." />
        )}
      </div>
    </AccountShell>
  );
}
