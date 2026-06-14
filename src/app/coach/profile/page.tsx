import Link from "next/link";
import { CoachShell } from "@/components/coach/CoachShell";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachProfileByOwner, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachProfileManagerPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [profile, access, unreadCount, notificationCount] = await Promise.all([
    getCoachProfileByOwner(user.id),
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
  ]);
  const profileStatus = coach.profile_status?.replaceAll("_", " ") ?? "draft";

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {coach.full_name}
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-slate-700">
                Edit your public photos, bio, sessions, services, best-fit players, and credentials.
                Submitted profiles are reviewed before they appear in coach search.
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold capitalize text-slate-950">{profileStatus}</p>
              <p className="mt-1 text-slate-600">{profile?.coach.profile_completion ?? 0}% complete</p>
            </div>
          </div>
          {coach.review_notes ? (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <p className="font-semibold">Review notes</p>
              <p>{coach.review_notes}</p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/coach/profile/edit"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Edit profile
            </Link>
            <Link
              href="/coach/profile/preview"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Preview
            </Link>
            {coach.is_published ? (
              <Link
                href={`/coaches/${coach.slug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
              >
                Public page
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </CoachShell>
  );
}
