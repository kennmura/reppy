import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

const benefits = [
  "Professional public coach profile",
  "Personal profile URL",
  "Service and pricing information",
  "Headshot and cover photo",
  "Message Centre training requests",
  "Visibility in the public coach directory",
];

export default function ForCoachesPage() {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_0.85fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            For Coaches
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Grow Your Private Coaching Business
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Create a professional public profile, showcase your training services, and get discovered
            by local parents and players.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <p key={benefit} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-[#2f6f5e]" />
                {benefit}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Founding Coach Plan
          </p>
          <p className="mt-4 text-4xl font-semibold text-slate-950">$5 per month</p>
          <p className="mt-4 leading-7 text-slate-700">
            Available to the first five coaches during the initial launch. No public listing is
            created automatically.
          </p>
          <Link
            href="/coach-register"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            Create Your Profile
          </Link>
        </div>
      </div>
    </main>
  );
}
