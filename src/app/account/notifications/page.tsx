import { AccountShell } from "@/components/account/AccountShell";
import { NotificationList } from "@/components/NotificationList";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountNotificationsPage() {
  const user = await getAccountUserOrRedirect();
  const [notificationCount, notifications] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getUserNotifications(user.id),
  ]);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <NotificationList notifications={notifications} />
    </AccountShell>
  );
}
