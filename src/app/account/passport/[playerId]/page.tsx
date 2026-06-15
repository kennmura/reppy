import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import {
  ClipGrid,
  FeedbackList,
  PassportBundleOverview,
  PassportEmptyState,
  PassportHeader,
  primaryButton,
  secondaryButton,
} from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PlayerPassportPage({ params }: { params: Promise<{ playerId: string }> }) {
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

  const publicHref = bundle.profile.slug ? `/players/${bundle.profile.slug}` : null;

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Development Passport"
          title={bundle.profile.display_name}
          body={[bundle.profile.sport, bundle.profile.position, bundle.profile.current_team].filter(Boolean).join(" - ")}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={`/account/passport/${playerId}/edit`} className={secondaryButton}>
                Edit profile
              </Link>
              {publicHref ? (
                <Link href={publicHref} className={primaryButton}>
                  Public profile
                </Link>
              ) : null}
            </div>
          }
        />
        <PassportBundleOverview bundle={bundle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Link href={`/account/passport/${playerId}/clips`} className={secondaryButton}>Clips</Link>
          <Link href={`/account/passport/${playerId}/reflections`} className={secondaryButton}>Reflections</Link>
          <Link href={`/account/passport/${playerId}/timeline`} className={secondaryButton}>Timeline</Link>
          <Link href={`/account/passport/${playerId}/sharing`} className={secondaryButton}>Sharing</Link>
          <Link href="/passport/join" className={secondaryButton}>Join team</Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-950">Recent coach feedback</h2>
            <FeedbackList feedback={bundle.feedback.slice(0, 5)} />
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-950">Active focus areas</h2>
            {bundle.focuses.filter((focus) => focus.status === "active").length ? (
              <div className="grid gap-3">
                {bundle.focuses.filter((focus) => focus.status === "active").map((focus) => (
                  <article key={focus.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-slate-950">{focus.focus_area}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{focus.description || "No description added."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <PassportEmptyState title="No active focus areas" body="Connected coaches can assign up to 3 focus areas per team/season." />
            )}
          </section>
        </div>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-950">Recent clips</h2>
          <ClipGrid clips={bundle.clips.slice(0, 4)} />
        </section>
      </div>
    </AccountShell>
  );
}
