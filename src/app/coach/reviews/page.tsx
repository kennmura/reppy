import { CoachShell } from "@/components/coach/CoachShell";
import { appUrl } from "@/lib/appUrl";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachReviewDashboard, getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";
import {
  createCoachReviewInviteAction,
  replyToCoachReviewAction,
  reportCoachReviewAction,
  revokeCoachReviewInviteAction,
} from "@/lib/reviewActions";
import type { CoachReview, CoachReviewInvite } from "@/lib/types";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  "invalid-email": "Enter a valid client email address.",
  "recent-invite": "That email already has a recent active invite.",
  "invite-failed": "The invite could not be created. Check server logs for details.",
  "missing-reply": "Add a reply before saving.",
  "missing-report": "Choose a report reason.",
};

const successMessages: Record<string, string> = {
  created: "Review invite created.",
  revoked: "Review invite revoked.",
};

const reviewMessages: Record<string, string> = {
  replied: "Coach reply saved.",
  reported: "Review reported for admin moderation.",
};

export default async function CoachReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; token?: string; review?: string }>;
}) {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const params = await searchParams;
  const [access, unreadCount, notificationCount, dashboard] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachReviewDashboard(coach.id),
  ]);
  const latestInviteUrl = params.token ? appUrl(`/reviews/${params.token}`) : null;

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Reviews</h1>
          <p className="mt-2 text-slate-600">
            Invite clients, reply to published reviews, and report reviews that need admin moderation.
          </p>
        </div>
        {params.error && errorMessages[params.error] ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessages[params.error]}</p>
        ) : null}
        {params.invite && successMessages[params.invite] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {successMessages[params.invite]}
          </p>
        ) : null}
        {params.review && reviewMessages[params.review] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {reviewMessages[params.review]}
          </p>
        ) : null}
        {latestInviteUrl ? (
          <section className="rounded-lg border border-[#d7e5dc] bg-[#f3f8f5] p-5">
            <p className="text-sm font-semibold text-slate-950">Shareable invite link</p>
            <p className="mt-2 break-all rounded-md bg-white px-3 py-2 text-sm text-slate-700">{latestInviteUrl}</p>
          </section>
        ) : null}
        <section className="grid gap-4 sm:grid-cols-4">
          <Metric label="Average rating" value={dashboard.summary.averageRating ? dashboard.summary.averageRating.toFixed(1) : "-"} />
          <Metric label="Published" value={dashboard.summary.publishedCount.toString()} />
          <Metric label="Pending" value={dashboard.summary.pendingCount.toString()} />
          <Metric label="Verified" value={dashboard.summary.verifiedCount.toString()} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Invite past client</h2>
          <form action={createCoachReviewInviteAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium text-slate-800">
              Client email
              <input
                name="email"
                type="email"
                required
                placeholder="client@example.com"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <label className="text-sm font-medium text-slate-800 md:col-span-2">
              Optional note
              <input
                name="note"
                placeholder="Thanks for training with me. I would appreciate a short review."
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <button className="h-11 self-end rounded-md bg-[#12355b] px-5 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Send invite
            </button>
          </form>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Reppy prevents repeated active invites to the same email within seven days.
          </p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Sent invites</h2>
          <InviteList invites={dashboard.invites} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Reviews</h2>
          <ReviewList reviews={dashboard.reviews} />
        </section>
      </div>
    </CoachShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InviteList({ invites }: { invites: CoachReviewInvite[] }) {
  if (!invites.length) {
    return <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No review invites yet.</p>;
  }

  return (
    <div className="mt-5 divide-y divide-slate-200">
      {invites.map((invite) => (
        <div key={invite.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_0.5fr_1fr_auto] lg:items-center">
          <div>
            <p className="font-semibold text-slate-950">{invite.invited_email_normalized}</p>
            <p className="mt-1 text-xs text-slate-500">{invite.invite_note || "No note"}</p>
          </div>
          <p className="text-sm capitalize text-slate-700">{invite.status}</p>
          <p className="break-all rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {appUrl(`/reviews/${invite.invite_token}`)}
          </p>
          {["sent", "opened"].includes(invite.status) ? (
            <form action={revokeCoachReviewInviteAction}>
              <input type="hidden" name="invite_id" value={invite.id} />
              <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                Revoke
              </button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewList({ reviews }: { reviews: CoachReview[] }) {
  if (!reviews.length) {
    return <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No reviews yet.</p>;
  }

  return (
    <div className="mt-5 space-y-4">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-950">{review.review_title || "Client review"}</p>
              <p className="mt-1 text-sm text-slate-600">
                {review.overall_rating}/5 - {review.review_type.replaceAll("_", " ")} - {review.status}
              </p>
            </div>
            <p className="text-sm text-slate-500">{new Date(review.created_at).toLocaleDateString()}</p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.review_body}</p>
          {review.status === "published" || review.status === "reported" ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <form action={replyToCoachReviewAction} className="grid gap-2">
                <input type="hidden" name="review_id" value={review.id} />
                <textarea
                  name="coach_reply"
                  defaultValue={review.coach_reply ?? ""}
                  placeholder="Public coach reply"
                  rows={3}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
                />
                <button className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500">
                  Save reply
                </button>
              </form>
              <form action={reportCoachReviewAction} className="grid gap-2">
                <input type="hidden" name="review_id" value={review.id} />
                <select
                  name="reason"
                  defaultValue=""
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
                >
                  <option value="">Report reason</option>
                  <option value="private-info">Private info</option>
                  <option value="harassment">Harassment or threats</option>
                  <option value="spam">Spam</option>
                  <option value="false-or-abusive">Clearly false or abusive</option>
                </select>
                <button className="w-fit rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Report review
                </button>
              </form>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
