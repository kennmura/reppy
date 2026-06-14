"use client";

import type { CoachAvailabilityBlock } from "@/lib/types";

export type SelectedAvailabilityPayload = {
  blockId: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

export function CoachAvailabilityPanel({
  blocks,
  timezone,
  ownerMode = false,
}: {
  blocks: CoachAvailabilityBlock[];
  timezone: string;
  ownerMode?: boolean;
}) {
  const upcomingDays = nextDays(14);
  const blocksByDate = new Map<string, CoachAvailabilityBlock[]>();
  for (const block of blocks) {
    const existing = blocksByDate.get(block.availability_date) ?? [];
    existing.push(block);
    blocksByDate.set(block.availability_date, existing);
  }

  function selectAvailability(selection: SelectedAvailabilityPayload) {
    if (ownerMode) {
      return;
    }

    window.dispatchEvent(new CustomEvent<SelectedAvailabilityPayload>("reppy:availability-selected", { detail: selection }));
    document.getElementById("request-training")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Times shown in {timezone}.</p>
        {ownerMode ? (
          <a href="/coach/calendar" className="text-sm font-semibold text-[#12355b]">
            Manage calendar
          </a>
        ) : null}
      </div>
      {blocks.length ? (
        <div className="grid gap-3">
          {blocks.slice(0, 8).map((block) => (
            <button
              key={block.id}
              type="button"
              disabled={ownerMode}
              onClick={() =>
                selectAvailability({
                  blockId: block.id,
                  date: block.availability_date,
                  startTime: block.start_time.slice(0, 5),
                  endTime: block.end_time.slice(0, 5),
                  timezone: block.timezone || timezone,
                })
              }
              className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-left text-sm transition hover:border-[#2f6f5e] focus:outline-none focus:ring-2 focus:ring-[#12355b]/20 disabled:cursor-default disabled:hover:border-[#d7e5dc]"
            >
              <span className="block font-semibold text-slate-950">{formatDate(block.availability_date)}</span>
              <span className="mt-1 block text-slate-700">
                {formatTime(block.start_time)} to {formatTime(block.end_time)}
              </span>
              {block.note ? <span className="mt-1 block text-xs text-slate-600">{block.note}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Availability not posted yet. You can still request training and suggest times.
        </p>
      )}
      {!ownerMode ? (
        <div>
          <p className="text-sm font-semibold text-slate-950">Pick a date to suggest your own time</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {upcomingDays.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() =>
                  selectAvailability({
                    blockId: "",
                    date,
                    startTime: "",
                    endTime: "",
                    timezone,
                  })
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:border-[#12355b] focus:outline-none focus:ring-2 focus:ring-[#12355b]/20"
              >
                {shortDate(date)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function nextDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return isoDate(date);
  });
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return parseIsoDate(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDate(value: string) {
  return parseIsoDate(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
