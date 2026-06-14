import { CoachShell } from "@/components/coach/CoachShell";
import { NotificationList } from "@/components/NotificationList";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount, getUserNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachNotificationsPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, notifications] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getUserNotifications(user.id),
  ]);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <NotificationList notifications={notifications} />
    </CoachShell>
  );
}
