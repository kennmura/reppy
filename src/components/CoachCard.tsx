import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import type { Coach } from "@/lib/types";

export function CoachCard({ coach }: { coach: Coach }) {
  const initials = coach.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 flex-none items-center justify-center rounded-full border border-slate-200 bg-[#12355b] bg-cover bg-center text-sm font-bold text-white"
          style={
            coach.profile_photo_url
              ? { backgroundImage: `url("${coach.profile_photo_url}")` }
              : undefined
          }
          aria-label={
            coach.profile_photo_url
              ? `${coach.full_name} profile photo`
              : `${coach.full_name} initials`
          }
        >
          {coach.profile_photo_url ? null : initials}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
            {coach.category ?? coach.sport}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {coach.full_name}
          </h2>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-[#2f6f5e]" />
        {coach.location}
      </p>
      <p className="mt-4 leading-7 text-slate-700">
        {coach.headline ?? "Personalized private and small-group coaching."}
      </p>
      <div className="mt-5 space-y-2 text-sm font-medium text-slate-700">
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2f6f5e]" />
          1-on-1 and small-group sessions
        </p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2f6f5e]" />
          Currently accepting new players
        </p>
      </div>
      <Link
        href={`/coaches/${coach.slug}`}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948] sm:w-fit"
      >
        View Profile
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}
