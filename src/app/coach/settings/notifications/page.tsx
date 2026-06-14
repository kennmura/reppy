import { CoachShell } from "@/components/coach/CoachShell";
import { NotificationSettingsPanel } from "@/components/NotificationSettingsPanel";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function CoachNotificationSettingsPage() {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Notification settings</h1>
          <p className="mt-2 text-slate-600">
            Get notified when a player requests training. Push is available to free and premium coaches.
          </p>
        </div>
        <NotificationSettingsPanel
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
          showFreeCoachEmail={!access.hasAccess}
        />
      </div>
    </CoachShell>
  );
}
