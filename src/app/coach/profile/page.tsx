import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function CoachProfileManagerPage() {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
  ]);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coach profile</h1>
        <p className="mt-3 leading-7 text-slate-700">
          Public profile editing is currently available through the protected admin editor while
          self-serve coach editing is prepared. Public profile text is scanned for direct contact
          methods so requests stay inside the Message Centre.
        </p>
        <Link
          href={`/coaches/${coach.slug}`}
          className="mt-6 inline-flex rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
        >
          View public profile
        </Link>
      </div>
    </CoachShell>
  );
}
