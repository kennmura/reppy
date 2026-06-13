import type { CoachService } from "@/lib/types";

export function ServiceCard({ service }: { service: CoachService }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">{service.title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
    </article>
  );
}
