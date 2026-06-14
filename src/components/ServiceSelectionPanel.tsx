"use client";

import { useState } from "react";
import type { CoachService } from "@/lib/types";

export type SelectedServicePayload = {
  id: string;
  title: string;
  description: string;
};

export function ServiceSelectionPanel({ services }: { services: CoachService[] }) {
  const [selectedServiceId, setSelectedServiceId] = useState("");

  function selectService(service: CoachService) {
    const selectedService: SelectedServicePayload = {
      id: service.id,
      title: service.title,
      description: service.description ?? "",
    };

    setSelectedServiceId(service.id);
    window.dispatchEvent(new CustomEvent<SelectedServicePayload>("reppy:service-selected", { detail: selectedService }));
    document.getElementById("request-training")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!services.length) {
    return (
      <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Services will appear here after the coach adds session details.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {services.map((service) => (
        <ServiceButton
          key={service.id}
          service={service}
          selected={selectedServiceId === service.id}
          onSelect={() => selectService(service)}
        />
      ))}
    </div>
  );
}

function ServiceButton({
  service,
  selected,
  onSelect,
}: {
  service: CoachService;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group rounded-lg border p-5 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#12355b]/20 ${
        selected
          ? "border-[#12355b] bg-[#f3f8f5] ring-2 ring-[#12355b]/15"
          : "border-slate-200 bg-white hover:border-[#12355b] hover:bg-[#f8fafc] focus:border-[#12355b]"
      }`}
    >
      <span className="block text-lg font-semibold text-slate-950 group-hover:text-[#12355b]">
        {service.title}
      </span>
      {service.description ? <span className="mt-3 block leading-7 text-slate-600">{service.description}</span> : null}
      <span className="mt-4 inline-flex text-sm font-semibold text-[#12355b]">
        {selected ? "Selected" : "Select this service"}
      </span>
    </button>
  );
}
