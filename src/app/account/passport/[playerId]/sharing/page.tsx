import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PassportEmptyState, PassportHeader, secondaryButton } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PassportSharingPage({ params }: { params: Promise<{ playerId: string }> }) {
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
          eyebrow="Sharing"
          title={`${bundle.profile.display_name} sharing settings`}
          body="Public profile fields are separate from the private development passport. For minors, sharing stays conservative until a parent is linked."
          action={<Link href={`/account/passport/${playerId}/edit`} className={secondaryButton}>Edit visibility</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <SharingCard label="Profile visibility" value={bundle.profile.visibility} />
          <SharingCard label="Parent linked" value={bundle.parentLinks.some((link) => link.status === "active") ? "yes" : "not yet"} />
          <SharingCard label="Minor profile" value={bundle.profile.is_minor ? "yes" : "no"} />
        </div>
        {publicHref ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Public profile</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Public pages never show DOB, exact address, private feedback, emails, phone, parent info, private clips, or handoff notes.
            </p>
            <Link href={publicHref} className="mt-4 inline-flex text-sm font-semibold text-[#12355b] hover:text-[#0d2948]">
              View public profile
            </Link>
          </section>
        ) : null}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Linked teams and coaches</h2>
          {bundle.teams.length ? (
            <div className="mt-4 divide-y divide-slate-200">
              {bundle.teams.map((team) => (
                <div key={team.id} className="py-3">
                  <p className="font-semibold text-slate-950">{team.name}</p>
                  <p className="text-sm capitalize text-slate-600">{team.sport} - {team.member.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No team connections yet.</p>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Parent/guardian links</h2>
          {bundle.parentLinks.length ? (
            <div className="mt-4 divide-y divide-slate-200">
              {bundle.parentLinks.map((link) => (
                <div key={link.id} className="py-3">
                  <p className="font-semibold text-slate-950">{link.parent_email_normalized || "Linked parent account"}</p>
                  <p className="text-sm capitalize text-slate-600">{link.status.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          ) : (
            <PassportEmptyState title="No parent link yet" body="Add a parent email on the edit page. Linked parents can see minor feedback, clips, reflections, and sharing settings." />
          )}
        </section>
      </div>
    </AccountShell>
  );
}

function SharingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
