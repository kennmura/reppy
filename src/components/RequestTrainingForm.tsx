"use client";

import { useState } from "react";

type FormState = "idle" | "loading" | "success" | "error";

export function RequestTrainingForm({ coachSlug = "ken-murakawa" }: { coachSlug?: string }) {
  const [state, setState] = useState<FormState>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/training-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, coach_slug: coachSlug }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    event.currentTarget.reset();
    setState("success");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="coach_slug" value={coachSlug} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Parent/player name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone number" name="phone" />
        <Field label="Player age" name="player_age" required />
        <Field label="Current level/team" name="current_level" />
        <Field label="Preferred location" name="preferred_location" />
        <Field label="Parent/guardian name" name="guardian_name" />
      </div>
      <Field label="Training goals" name="training_goals" required textarea />
      <Field label="Preferred days/times" name="preferred_days_times" textarea />
      <Field label="Message" name="message" textarea />
      <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm leading-6 text-slate-700">
        <input name="guardian_confirmed" type="checkbox" required className="mt-1 h-4 w-4" />
        <span>
          I confirm that a parent or guardian is involved in this training request and related
          communication.
        </span>
      </label>
      <p className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm leading-6 text-slate-700">
        For players under 18, a parent or guardian should be involved in all training communication
        and scheduling.
      </p>
      <button
        type="submit"
        disabled={state === "loading"}
        className="inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
      >
        {state === "loading" ? "Sending..." : "Request Training"}
      </button>
      {state === "success" ? (
        <p className="text-sm font-medium text-[#2f6f5e]">
          Your request has been sent to the coach&apos;s Message Centre. You&apos;ll receive an email when
          the coach replies.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm font-medium text-red-700">
          Something went wrong. Please try again.
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  textarea = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {required ? <span className="text-red-700"> *</span> : null}
      {textarea ? (
        <textarea name={name} required={required} rows={4} className={className} />
      ) : (
        <input name={name} type={type} required={required} className={className} />
      )}
    </label>
  );
}
