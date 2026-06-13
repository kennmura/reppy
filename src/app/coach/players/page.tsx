import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachPlayerRecords, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function CoachPlayersPage() {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, players] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
    getCoachPlayerRecords(coach.id),
  ]);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Players</h1>
          <p className="mt-2 text-slate-600">
            Lightweight player records are premium-only and do not store direct contact details.
          </p>
        </div>
        <TrialBanner access={access} />
        {!access.hasAccess ? (
          <LockedPanel title="Player management is locked" />
        ) : players.length ? (
          <div className="grid gap-4">
            {players.map((player) => (
              <article key={player.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{player.display_name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {player.sport || "Sport not set"} · {player.current_level || "Level not set"}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                    {player.status}
                  </span>
                </div>
                {player.training_goals ? (
                  <p className="mt-4 leading-7 text-slate-700">{player.training_goals}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            No player records yet. Mark a conversation Scheduled or Completed, then use Add to My
            Players from that conversation.
          </div>
        )}
      </div>
    </CoachShell>
  );
}

function LockedPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-slate-600">
        Start your trial or upgrade to access player records. Existing records are preserved while
        access is locked.
      </p>
    </div>
  );
}
