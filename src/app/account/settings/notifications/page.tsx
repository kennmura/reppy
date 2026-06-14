import { AccountShell } from "@/components/account/AccountShell";
import { NotificationSettingsPanel } from "@/components/NotificationSettingsPanel";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountNotificationSettingsPage() {
  const user = await getAccountUserOrRedirect();
  const notificationCount = await getUnreadNotificationCount(user.id);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Notification settings</h1>
          <p className="mt-2 text-slate-600">Get notified when a coach responds.</p>
        </div>
        <NotificationSettingsPanel vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      </div>
    </AccountShell>
  );
}
