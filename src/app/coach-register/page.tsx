import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CoachApplicationForm } from "@/components/CoachApplicationForm";

export default function CoachRegisterPage() {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <Link
            href="/coaches"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#12355b] hover:text-[#0d2948]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to coaches
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Coach Registration
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Get on the coaching radar.
          </h1>
          <p className="mt-4 leading-7 text-slate-700">
            Reppy is starting with private soccer training in Greater Boston and will expand to more
            local coaches over time. Share your coaching background so we can follow up before any
            public profile goes live.
          </p>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm">
            <p className="font-semibold text-slate-950">No public listing is created automatically.</p>
            <p className="mt-2">
              This form is only an interest/registration step for coaches who want to be considered
              as the directory grows.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <CoachApplicationForm />
        </div>
      </div>
    </main>
  );
}
