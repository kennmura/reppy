import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachProfile } from "@/components/CoachProfile";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachProfileByOwner } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CoachProfilePreviewPage() {
  const { user } = await getCoachContextOrRedirect();
  const profile = await getCoachProfileByOwner(user.id);

  if (!profile) {
    notFound();
  }

  return (
    <main>
      <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Preview mode. This may include draft or pending changes that are not public yet.
          </p>
          <div className="flex gap-3">
            <Link href="/coach/profile/edit" className="font-semibold text-[#12355b]">
              Edit
            </Link>
            <Link href="/coach/dashboard" className="font-semibold text-[#12355b]">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
      <CoachProfile profile={profile} viewerMode="owner" />
    </main>
  );
}
