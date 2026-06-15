import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PassportEmptyState, PassportHeader } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PassportTimelinePage({ params }: { params: Promise<{ playerId: string }> }) {
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
          eyebrow="Development Timeline"
          title={`${bundle.profile.display_name} timeline`}
          body="Private timeline events help future coaches understand the player faster without exposing private details publicly."
        />
        {bundle.timeline.length ? (
          <div className="relative grid gap-4 border-l border-slate-200 pl-5">
            {bundle.timeline.map((event) => (
              <article key={event.id} className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <span className="absolute -left-[29px] top-6 h-3 w-3 rounded-full bg-[#12355b]" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6f5e]">{event.event_type.replaceAll("_", " ")}</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">{event.title}</h2>
                {event.body ? <p className="mt-2 text-sm leading-6 text-slate-600">{event.body}</p> : null}
                <p className="mt-3 text-xs text-slate-500">{new Date(event.occurred_at).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        ) : (
          <PassportEmptyState title="Timeline is building" body="Profile updates, team joins, clips, feedback, focus areas, reflections, and handoff summaries will appear here." />
        )}
      </div>
    </AccountShell>
  );
}
