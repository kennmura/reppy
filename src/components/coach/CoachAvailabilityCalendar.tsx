"use client";

import { useMemo, useState } from "react";
import { deleteCoachAvailabilityBlock, saveCoachAvailabilityBlock } from "@/lib/actions";
import type { CoachAvailabilityBlock, TrainingRequest } from "@/lib/types";

type CalendarMessage = {
  type: "success" | "error";
  text: string;
} | null;

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CoachAvailabilityCalendar({
  blocks,
  requests,
  premiumCalendarEnabled,
  initialDate,
  message,
}: {
  blocks: CoachAvailabilityBlock[];
  requests: TrainingRequest[];
  premiumCalendarEnabled: boolean;
  initialDate: string;
  message?: CalendarMessage;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [editingBlock, setEditingBlock] = useState<CoachAvailabilityBlock | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseIsoDate(initialDate)));
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, CoachAvailabilityBlock[]>();
    for (const block of blocks) {
      const existing = grouped.get(block.availability_date) ?? [];
      existing.push(block);
      grouped.set(block.availability_date, existing);
    }
    return grouped;
  }, [blocks]);
  const selectedBlocks = blocksByDate.get(selectedDate) ?? [];
  const selectedRequests = requests.filter((request) => request.requested_date === selectedDate);
  const formKey = `${selectedDate}-${editingBlock?.id ?? "new"}`;

  function selectDate(date: string) {
    setSelectedDate(date);
    setEditingBlock(null);
  }

  function changeMonth(offset: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
              Calendar
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateKey = isoDate(day);
            const dayBlocks = blocksByDate.get(dateKey) ?? [];
            const isSelected = selectedDate === dateKey;
            const inCurrentMonth = day.getMonth() === visibleMonth.getMonth();

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => selectDate(dateKey)}
                aria-pressed={isSelected}
                className={`min-h-24 rounded-md border p-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[#12355b]/20 ${
                  isSelected
                    ? "border-[#12355b] bg-[#f3f8f5]"
                    : "border-slate-200 bg-white hover:border-[#12355b]"
                } ${inCurrentMonth ? "text-slate-950" : "text-slate-400"}`}
              >
                <span className="font-semibold">{day.getDate()}</span>
                {dayBlocks.length ? (
                  <span className="mt-2 block rounded bg-[#12355b] px-2 py-1 text-xs font-semibold text-white">
                    {dayBlocks.length} block{dayBlocks.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">
          {formatDateLabel(selectedDate)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add the hours you are available for training on this day.
        </p>
        {message ? (
          <div
            className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form key={formKey} action={saveCoachAvailabilityBlock} className="mt-5 grid gap-4">
          <input type="hidden" name="block_id" value={editingBlock?.id ?? ""} readOnly />
          <input type="hidden" name="availability_date" value={selectedDate} readOnly />
          <input type="hidden" name="timezone" value="America/New_York" readOnly />
          <input type="hidden" name="return_to" value="/coach/calendar" readOnly />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Start time
              <input
                name="start_time"
                type="time"
                required
                defaultValue={editingBlock?.start_time?.slice(0, 5) ?? ""}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              End time
              <input
                name="end_time"
                type="time"
                required
                defaultValue={editingBlock?.end_time?.slice(0, 5) ?? ""}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
          </div>
          <label className="text-sm font-medium text-slate-800">
            Note or location
            <input
              name="note"
              defaultValue={editingBlock?.note ?? ""}
              placeholder="Optional, for example: turf field or video sessions"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-11 items-center justify-center rounded-md bg-[#12355b] px-5 text-sm font-semibold text-white hover:bg-[#0d2948]">
              {editingBlock ? "Save changes" : "Add hours"}
            </button>
            {editingBlock ? (
              <button
                type="button"
                onClick={() => setEditingBlock(null)}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:border-slate-500"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            Saved hours
          </h3>
          {selectedBlocks.length ? (
            <div className="mt-3 grid gap-3">
              {selectedBlocks.map((block) => (
                <div key={block.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {formatTimeLabel(block.start_time)} to {formatTimeLabel(block.end_time)}
                      </p>
                      {block.note ? <p className="mt-1 text-sm text-slate-600">{block.note}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBlock(block)}
                        className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
                      >
                        Edit
                      </button>
                      <form action={deleteCoachAvailabilityBlock}>
                        <input type="hidden" name="block_id" value={block.id} />
                        <input type="hidden" name="availability_date" value={block.availability_date} />
                        <input type="hidden" name="return_to" value="/coach/calendar" />
                        <button className="inline-flex h-10 items-center rounded-md border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:border-red-300">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              No hours saved for this day yet.
            </p>
          )}
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            Training requests
          </h3>
          {premiumCalendarEnabled ? (
            selectedRequests.length ? (
              <div className="mt-3 grid gap-3">
                {selectedRequests.map((request) => (
                  <a
                    key={request.id}
                    href={request.conversation_id ? `/coach/messages/${request.conversation_id}` : "/coach/messages"}
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 hover:border-amber-300"
                  >
                    <span className="block font-semibold capitalize">{request.status} request</span>
                    <span className="mt-1 block">
                      {request.name} - {request.service_title || "General training request"}
                    </span>
                    <span className="mt-1 block">
                      {request.requested_start_time
                        ? `${formatTimeLabel(request.requested_start_time)} to ${formatTimeLabel(request.requested_end_time ?? "")}`
                        : "Preferred time in request"}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No dated requests for this day.
              </p>
            )
          ) : (
            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Premium calendar request visibility is locked. Requests still arrive in Message Center and notifications.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDays(monthDate: Date) {
  const first = startOfMonth(monthDate);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatDateLabel(value: string) {
  return parseIsoDate(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(value: string) {
  if (!value) {
    return "";
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return new Date(2026, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
