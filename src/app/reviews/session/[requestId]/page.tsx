import Link from "next/link";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getVerifiedSessionReviewContext } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VerifiedSessionReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const user = await getAccountUserOrRedirect();
  const { requestId } = await params;
  const context = await getVerifiedSessionReviewContext(requestId, user.id);

  if (!context) {
    return (
      <main className="bg-[#f7f8f3] py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Review unavailable</h1>
            <p className="mt-3 leading-7 text-slate-700">
              Verified session reviews are available after a Reppy request is paid or completed.
            </p>
            <Link
              href="/account/messages"
              className="mt-6 inline-flex rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Back to messages
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Verified Reppy session</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Review {context.coach.full_name}
          </h1>
          <p className="mt-3 leading-7 text-slate-700">
            This review can be marked as verified because it is tied to a paid or completed Reppy request.
          </p>
          <div className="mt-6">
            <ReviewForm
              coach={context.coach}
              trainingRequestId={context.request.id}
              reviewType="verified_session"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
