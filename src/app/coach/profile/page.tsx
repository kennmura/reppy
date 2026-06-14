import { notFound } from "next/navigation";
import { CoachProfile } from "@/components/CoachProfile";
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

  if (!profile) {
    notFound();
  }

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <CoachProfile profile={profile} viewerMode="owner" />
    </CoachShell>
  );
}
