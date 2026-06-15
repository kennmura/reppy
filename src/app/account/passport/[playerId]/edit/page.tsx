import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PassportHeader, PlayerProfileForm } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { canManagePlayerProfile, getPlayerPassportBundle } from "@/lib/passportData";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function EditPassportProfilePage({ params }: { params: Promise<{ playerId: string }> }) {
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
          eyebrow="Edit Passport"
          title={bundle.profile.display_name}
          body="Manage public profile fields and private development settings."
        />
        <PlayerProfileForm player={bundle.profile} />
      </div>
    </AccountShell>
  );
}
