import { MapPin } from "lucide-react";
import type { Coach } from "@/lib/types";

export function LocationSection({ coach }: { coach: Coach }) {
  return (
    <section className="bg-[#f7f8f3] py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Location</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {coach.location}
          </h2>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <MapPin className="h-6 w-6 text-[#2f6f5e]" />
          <p className="mt-4 leading-7 text-slate-700">{coach.service_area}</p>
          <p className="mt-4 text-sm font-medium text-slate-950">
            Training locations are discussed after an inquiry is submitted.
          </p>
        </div>
      </div>
    </section>
  );
}
