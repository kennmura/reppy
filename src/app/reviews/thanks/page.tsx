import Link from "next/link";
import { getCoachProfileBySlug } from "@/lib/data";

export default async function ReviewThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ coach?: string }>;
}) {
  const params = await searchParams;
  const profile = params.coach ? await getCoachProfileBySlug(params.coach) : null;
  const coach = profile?.coach ?? null;

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Review submitted</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Thanks for helping Reppy build trust.</h1>
          <p className="mt-4 leading-7 text-slate-700">
            Your review is pending moderation. Reppy checks reviews for spam, private contact details, and youth-safety issues before publishing.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {coach ? (
              <>
                <Link
                  href={`/coaches/${coach.slug}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
                >
                  Coach profile
                </Link>
                <Link
                  href={`/coaches/${coach.slug}#request-training`}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
                >
                  Request training
                </Link>
              </>
            ) : null}
            <Link
              href="/coaches"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
            >
              Browse coaches
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
