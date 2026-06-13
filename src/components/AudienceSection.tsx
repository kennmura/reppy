import { Check } from "lucide-react";
import type { CoachAudience } from "@/lib/types";

export function AudienceSection({ audiences }: { audiences: CoachAudience[] }) {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Who it&apos;s for</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Best for players who want focused reps, clear feedback, and a training plan that connects
          technique to real game situations.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <div key={audience.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-[#fafbf8] px-4 py-3">
              <Check className="h-5 w-5 flex-none text-[#2f6f5e]" />
              <span className="text-sm font-medium text-slate-800">{audience.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
