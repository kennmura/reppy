import { AccountShell } from "@/components/account/AccountShell";
import { PassportHeader, PlayerProfileForm } from "@/components/passport/PassportComponents";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NewPassportProfilePage() {
  const { user } = await getAccountContextOrRedirect();
  const notificationCount = await getUnreadNotificationCount(user.id);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <div className="space-y-6 pb-16 md:pb-0">
        <PassportHeader
          eyebrow="Create Passport"
          title="Add an athlete profile"
          body="New minor profiles default to private. You can choose public visibility later when sharing is appropriate."
        />
        <PlayerProfileForm />
      </div>
    </AccountShell>
  );
}
