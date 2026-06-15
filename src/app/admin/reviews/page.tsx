import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoachReviews } from "@/lib/data";
import { moderateCoachReviewAction } from "@/lib/reviewActions";
import type { Coach, CoachReview } from "@/lib/types";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  published: "Review published.",
  hidden: "Review hidden.",
  removed: "Review removed.",
};

const errors: Record<string, string> = {
  "invalid-decision": "Choose a valid moderation decision.",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string; error?: string }>;
}) {
  await getAdminUserOrRedirect();
  const params = await searchParams;
  const { reviews, coaches } = await getAdminCoachReviews();
  const pending = reviews.filter((review) => review.status === "pending").length;
  const reported = reviews.filter((review) => review.status === "reported").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Review moderation</h1>
          <p className="mt-2 text-slate-600">
            Publish, hide, or remove coach reviews. Use this for spam, private info, harassment, threats, or clearly abusive content.
          </p>
        </div>
        {params.review && messages[params.review] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{messages[params.review]}</p>
        ) : null}
        {params.error && errors[params.error] ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors[params.error]}</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Total reviews" value={reviews.length} />
          <Metric label="Pending" value={pending} />
          <Metric label="Reported" value={reported} />
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Moderation queue</h2>
          {reviews.length ? (
            <div className="mt-5 space-y-4">
              {reviews.map((review) => (
                <ReviewModerationCard key={review.id} review={review} coach={coaches.get(review.coach_id) ?? null} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No reviews yet.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ReviewModerationCard({ review, coach }: { review: CoachReview; coach: Coach | null }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{review.review_title || "Client review"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {coach?.full_name ?? "Unknown coach"} - {review.overall_rating}/5 - {review.review_type.replaceAll("_", " ")}
          </p>
        </div>
        <span className="h-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
          {review.status}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Detail label="Reviewer label" value={reviewerLabel(review)} />
        <Detail label="Training type" value={review.training_type || "Not provided"} />
        <Detail label="Created" value={new Date(review.created_at).toLocaleString()} />
      </dl>
      <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">{review.review_body}</p>
      {review.report_reason ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Reported: {review.report_reason}
        </p>
      ) : null}
      {review.coach_reply ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Coach reply: {review.coach_reply}
        </p>
      ) : null}
      <form action={moderateCoachReviewAction} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="review_id" value={review.id} />
        <button name="decision" value="published" className="rounded-md bg-[#12355b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]">
          Publish
        </button>
        <button name="decision" value="hidden" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500">
          Hide
        </button>
        <button name="decision" value="removed" className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
          Remove
        </button>
      </form>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="mt-1 text-slate-700">{value}</dd>
    </div>
  );
}

function reviewerLabel(review: CoachReview) {
  if (review.reviewer_relationship === "adult_player") {
    return "Adult player";
  }
  if (review.reviewer_relationship === "former_player") {
    return "Former player";
  }
  if (review.reviewer_relationship === "player") {
    return review.player_age_band ? `${review.player_age_band} player` : "Player";
  }
  return review.player_age_band ? `Parent of ${review.player_age_band} player` : "Parent/guardian";
}
