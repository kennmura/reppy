"use client";

import { useState } from "react";
import { sports } from "@/lib/sports";

type FormState = "idle" | "loading" | "success" | "error";

export function CoachApplicationForm() {
  const [state, setState] = useState<FormState>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") {
      return;
    }

    const form = event.currentTarget;
    setState("loading");

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/coach-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      form.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" name="full_name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone number" name="phone" />
        <label className="block text-sm font-medium text-slate-800">
          Sport <span className="text-red-700">*</span>
          <select
            name="sport"
            required
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          >
            <option value="">Select a sport</option>
            {sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
        <Field label="Location / service area" name="location" required />
        <Field label="Coaching focus" name="coaching_focus" placeholder="Private training, small groups, recruiting help..." />
      </div>
      <Field
        label="Tell us about your coaching background"
        name="background"
        required
        textarea
        placeholder="Playing/coaching experience, age groups you work with, and what kind of players you help."
      />
      <Field
        label="Anything else?"
        name="message"
        textarea
        placeholder="Links, availability, questions, or anything useful to know."
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
      >
        {state === "loading" ? "Sending..." : "Get on the coaching radar"}
      </button>
      {state === "success" ? (
        <p className="text-sm font-medium text-[#2f6f5e]">
          Thanks - your coach registration has been received. We will follow up before publishing
          any profile.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm font-medium text-red-700">
          Something went wrong. Please try again in a moment.
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
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  placeholder?: string;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {required ? <span className="text-red-700"> *</span> : null}
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={5}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  );
}
