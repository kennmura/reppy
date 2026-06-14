import { CoachProfileEditor } from "@/components/coach/CoachProfileEditor";
import { CoachShell } from "@/components/coach/CoachShell";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachProfileByOwner, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const messages: Record<string, { type: "success" | "error"; text: string }> = {
  saved: { type: "success", text: "Profile saved." },
  submitted: { type: "success", text: "Profile submitted for review." },
  "missing-required": { type: "error", text: "Full name, slug, and sport are required." },
  "missing-location": { type: "error", text: "Enter your location or ZIP code before saving." },
  "slug-taken": { type: "error", text: "That profile slug is already taken." },
  "public-contact": {
    type: "error",
    text: "Remove public phone numbers, emails, social handles, or direct booking instructions before submitting.",
  },
};

export default async function CoachProfileEditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const { user, profile, coach, coachUserId } = await getCoachContextOrRedirect();
  const [coachProfile, access, unreadCount, notificationCount] = await Promise.all([
    getCoachProfileByOwner(user.id),
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
  ]);
  const messageKey = params.error ?? (params.submitted ? "submitted" : params.saved ? "saved" : "");

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <CoachProfileEditor
        profile={coachProfile}
        displayName={profile.display_name || user.email || "Coach"}
        returnTo="/coach/profile/edit"
        message={messages[messageKey] ?? null}
        submitLabel={coach.profile_status === "published" ? "Submit updates for review" : "Submit for review"}
      />
    </CoachShell>
  );
}
