import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { ClipForm, ClipGrid, PassportHeader } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PassportClipsPage({ params }: { params: Promise<{ playerId: string }> }) {
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
          eyebrow="Passport Clips"
          title={`${bundle.profile.display_name} clips`}
          body="Add short player clips. Public clips can appear on the public player profile; coach-uploaded clips stay private."
        />
        <ClipForm playerId={playerId} returnTo={`/account/passport/${playerId}/clips`} />
        <ClipGrid clips={bundle.clips} />
      </div>
    </AccountShell>
  );
}
