import type { Coach } from "@/lib/types";

export function PricingSection({ coach }: { coach: Coach }) {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-[#f7f8f3] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {coach.pricing_text}
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-slate-700">
            Session pricing may vary based on location, session type, group size, and training goals.
          </p>
        </div>
      </div>
    </section>
  );
}
