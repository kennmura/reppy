import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { PassportEmptyState, PassportHeader, PassportMetric, PlayerPassportCard, primaryButton, secondaryButton } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { getAccountPassportDashboard } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { isPassportEnabled } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

export default async function AccountPassportPage() {
  const { user } = await getAccountContextOrRedirect();
  const [notificationCount, dashboard] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountPassportDashboard(user.id, user.email),
  ]);
  const playersById = new Map([...dashboard.players, ...dashboard.parentLinkedPlayers].map((player) => [player.id, player]));
  const players = [...playersById.values()];

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Reppy Passport"
          title="Player development passport"
          body="Carry clips, coach feedback, focus areas, game reflections, and handoff summaries across high school, club, and private training."
          action={
            <Link href="/account/passport/edit" className={primaryButton}>
              Add player
            </Link>
          }
        />
        {!isPassportEnabled() ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Passport routes are deployed, but `REPPY_PASSPORT_ENABLED` is currently off.
          </section>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <PassportMetric label="Athletes" value={players.length} />
          <PassportMetric label="Pending invites" value={dashboard.invites.length} />
          <PassportMetric label="Linked as parent" value={dashboard.parentLinkedPlayers.length} />
        </div>
        {dashboard.invites.length ? (
          <section className="rounded-lg border border-[#d7e5dc] bg-[#f3f8f5] p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Roster invites waiting</h2>
            <div className="mt-4 grid gap-3">
              {dashboard.invites.map((invite) => (
                <Link key={invite.id} href={`/passport/join?code=${invite.join_code}`} className={secondaryButton}>
                  Join {invite.team_name || "team"} as {invite.player_name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {players.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {players.map((player) => (
              <PlayerPassportCard key={player.id} player={player} />
            ))}
          </div>
        ) : (
          <PassportEmptyState
            title="No athletes linked yet"
            body="Create a player Passport or accept a roster invite from a team coach."
            href="/account/passport/edit"
            label="Create Passport"
          />
        )}
      </div>
    </AccountShell>
  );
}
