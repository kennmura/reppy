import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import type { Coach } from "@/lib/types";

export function CoachCard({ coach }: { coach: Coach }) {
  const initials = coach.full_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  const acceptingRequests = coach.accepting_requests !== false;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          role="img"
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
            {coach.sport ?? coach.category ?? "Coach"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {coach.full_name}
          </h2>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-[#2f6f5e]" />
        <span>
          {coach.location}
          {typeof coach.distance_miles === "number" ? (
            <span className="font-medium text-slate-800">
              {" "}
              - {coach.distance_miles.toFixed(1)} miles away
            </span>
          ) : null}
        </span>
      </p>
      <p className="mt-4 leading-7 text-slate-700">
        {coach.headline ?? "Personalized private and small-group coaching."}
      </p>
      <div className="mt-5 grid gap-2 text-sm font-medium text-slate-700 sm:grid-cols-2">
        <CardFact label={coach.training_format || "Private / small group"} />
        <CardFact label={coach.age_groups || "Youth and adult players"} />
        <CardFact label={coach.pricing_text || "Contact for pricing"} />
        <CardFact
          label={acceptingRequests ? "Accepting requests" : "Not currently accepting requests"}
          muted={!acceptingRequests}
        />
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

function CardFact({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <p className={`flex items-start gap-2 ${muted ? "text-slate-500" : ""}`}>
      <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-none ${muted ? "text-slate-400" : "text-[#2f6f5e]"}`} />
      <span>{label}</span>
    </p>
  );
}
