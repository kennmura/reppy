import { CoachAvailabilityCalendar } from "@/components/coach/CoachAvailabilityCalendar";
import { CoachShell } from "@/components/coach/CoachShell";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachAvailabilityBlocks, getCoachCalendarTrainingRequests, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const messages: Record<string, { type: "success" | "error"; text: string }> = {
  saved: { type: "success", text: "Availability saved." },
  deleted: { type: "success", text: "Availability removed." },
  "invalid-time": { type: "error", text: "Choose a valid date, start time, and end time." },
  "end-before-start": { type: "error", text: "End time must be after start time." },
  "save-failed": { type: "error", text: "Availability could not be saved. Please try again." },
  "delete-failed": { type: "error", text: "Availability could not be removed. Please try again." },
  "missing-block": { type: "error", text: "Choose an availability block to delete." },
};

export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, availabilityBlocks] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachAvailabilityBlocks(coach.id),
  ]);
  const calendarRequests = access.hasAccess ? await getCoachCalendarTrainingRequests(coach.id) : [];
  const messageKey = params.error ?? (params.deleted ? "deleted" : params.saved ? "saved" : "");
  const initialDate = validIsoDate(params.date) ? params.date : isoDate(new Date());

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <CoachAvailabilityCalendar
        blocks={availabilityBlocks}
        requests={calendarRequests}
        premiumCalendarEnabled={access.hasAccess}
        initialDate={initialDate}
        message={messages[messageKey] ?? null}
      />
    </CoachShell>
  );
}

function validIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
