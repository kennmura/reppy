"use client";

import { type HTMLAttributes, useEffect, useState } from "react";
import type { AccountRequestProfile } from "@/lib/accountProfile";
import type { CoachService } from "@/lib/types";
import type { SelectedAvailabilityPayload } from "./CoachAvailabilityPanel";

type SubmissionState = "idle" | "submitting" | "success" | "error";

type TrainingRequestResponse =
  | {
      success: true;
      requestId: string;
      conversationId: string;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        fields?: Record<string, string>;
      };
    };

const requestErrorMessages: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in or create a Player/Parent Account before sending a training request.",
  EMAIL_NOT_VERIFIED: "Verify your email before sending a training request.",
  PHONE_NOT_VERIFIED: "Verify your phone before sending a training request.",
  VALIDATION_ERROR: "Please correct the highlighted fields.",
  PROFILE_INCOMPLETE: "Please complete your player profile before requesting training.",
  COACH_UNAVAILABLE: "We could not find this coach.",
  SERVICE_NOT_FOUND: "We could not find that training service.",
  SERVICE_COACH_MISMATCH: "That training service does not belong to this coach.",
  UNAUTHORIZED: "You must be logged in as a player or parent to request training.",
  DUPLICATE_ACTIVE_REQUEST:
    "You already have an active request with this coach. Open your Message Center to continue the conversation.",
  RATE_LIMITED: "You are sending requests too quickly. Please wait and try again.",
  REQUEST_LOOKUP_FAILED: "We could not verify this request. Please try again.",
  CONVERSATION_CREATE_FAILED: "We could not start the coach conversation. Please try again.",
  REQUEST_CREATE_FAILED: "We could not send this training request. Please try again.",
  SERVER_ERROR: "Training requests are temporarily unavailable. Please try again.",
};

type SelectedService = {
  id: string;
  title: string;
  description: string;
};

export function RequestTrainingForm({
  coachId,
  coachSlug = "ken-murakawa",
  services = [],
  accountProfile,
}: {
  coachId: string;
  coachSlug?: string;
  services?: CoachService[];
  accountProfile: AccountRequestProfile;
}) {
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState("");
  const [showAuthLinks, setShowAuthLinks] = useState(false);
  const [showProfileLink, setShowProfileLink] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const [selectedService, setSelectedService] = useState<SelectedService | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState<SelectedAvailabilityPayload | null>(null);
  const guardianRequired = accountProfile.playerAgeAtRequest === null || accountProfile.playerAgeAtRequest < 18;

  useServiceSelection((service) => setSelectedService(service));
  useAvailabilitySelection((availability) => setSelectedAvailability(availability));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.coach_slug) {
      payload.coach_slug = coachSlug;
    }
    payload.coach_id = coachId;

    setState("submitting");
    setError("");
    setShowAuthLinks(false);
    setShowProfileLink(false);
    setConversationId("");

    try {
      const response = await fetch("/api/training-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as TrainingRequestResponse | null)
        : null;

      if (!response.ok || !body?.success) {
        const code = body && !body.success ? body.error.code : "";
        const fieldErrors =
          body && !body.success && body.error.fields
            ? Object.values(body.error.fields)
                .filter(Boolean)
                .join(" ")
            : "";
        const message =
          requestErrorMessages[code] ?? (body && !body.success ? body.error.message : "Something went wrong. Please try again.");
        setError(fieldErrors ? `${message} ${fieldErrors}` : message);
        setShowAuthLinks(code === "AUTH_REQUIRED");
        setShowProfileLink(code === "PROFILE_INCOMPLETE");
        setState("error");
        return;
      }

      form.reset();
      setConversationId(body.conversationId);
      setClientRequestId(crypto.randomUUID());
      setState("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="coach_id" value={coachId} />
      <input type="hidden" name="coach_slug" value={coachSlug} />
      <input type="hidden" name="client_request_id" value={clientRequestId} />
      <input type="hidden" name="service_id" value={selectedService?.id ?? ""} />
      <input type="hidden" name="service_title" value={selectedService?.title ?? ""} />
      <input type="hidden" name="service_description" value={selectedService?.description ?? ""} />
      <input type="hidden" name="selected_availability_block_id" value={selectedAvailability?.blockId ?? ""} />
      <input type="hidden" name="requested_date" value={selectedAvailability?.date ?? ""} />
      <input type="hidden" name="requested_start_time" value={selectedAvailability?.startTime ?? ""} />
      <input type="hidden" name="requested_end_time" value={selectedAvailability?.endTime ?? ""} />
      <input type="hidden" name="timezone" value={selectedAvailability?.timezone ?? "America/New_York"} />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Player profile</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <SummaryItem label="Player" value={accountProfile.playerName} />
          <SummaryItem label="Parent/guardian" value={accountProfile.guardianName || "Not needed"} />
          <SummaryItem label="Player age" value={accountProfile.playerAge} />
          <SummaryItem label="Club/team" value={accountProfile.currentTeam} />
        </dl>
      </div>
      <div className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] p-4">
        <p className="text-sm font-semibold text-slate-950">Selected service</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          {selectedService?.title ?? "General training request"}
        </p>
        {!selectedService && services.length ? (
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Select a service card above to request a specific session.
          </p>
        ) : null}
      </div>
      {selectedAvailability ? (
        <div className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] p-4">
          <p className="text-sm font-semibold text-slate-950">
            {selectedAvailability.startTime ? "Requested time" : "Requested date"}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {formatSelectedAvailability(selectedAvailability)}
          </p>
          <button
            type="button"
            onClick={() => setSelectedAvailability(null)}
            className="mt-2 text-xs font-semibold text-[#12355b]"
          >
            Clear selected time
          </button>
        </div>
      ) : null}
      <Field
        label="Training goals"
        name="training_goals"
        defaultValue={accountProfile.goals}
        autoComplete="off"
        required
        textarea
      />
      <Field
        label="Preferred days/times"
        name="preferred_days_times"
        defaultValue={accountProfile.preferredDays}
        autoComplete="off"
        required
        textarea
      />
      <Field
        label="Preferred location"
        name="preferred_location"
        defaultValue={accountProfile.preferredLocation}
        autoComplete="street-address"
      />
      <Field label="Message" name="message" autoComplete="off" textarea />
      <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm leading-6 text-slate-700">
        <input name="guardian_confirmed" type="checkbox" required={guardianRequired} className="mt-1 h-4 w-4" />
        <span>
          For athletes under 18, a parent or guardian must be involved in all training communication
          and scheduling.
        </span>
      </label>
      <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm leading-6 text-slate-700">
        <input name="terms_confirmed" type="checkbox" required className="mt-1 h-4 w-4" />
        <span>I agree to use Reppy messaging for training communication.</span>
      </label>
      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
      >
        {state === "submitting" ? "Sending request..." : "Request Training"}
      </button>
      <div aria-live="polite">
        {state === "success" ? (
          <div className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">
              Your request was sent. You can continue the conversation in your Message Center.
            </p>
            {conversationId ? (
              <a
                href={`/account/messages/${conversationId}`}
                className="inline-flex w-fit rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]"
              >
                Open Message Center
              </a>
            ) : null}
          </div>
        ) : null}
        {state === "error" ? (
          <div className="grid gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-medium">{error}</p>
            {showAuthLinks ? (
              <div className="flex flex-wrap gap-3">
                <a href="/account/login" className="font-semibold text-[#12355b]">
                  Sign in
                </a>
                <a href="/account/register" className="font-semibold text-[#12355b]">
                  Create Player/Parent Account
                </a>
              </div>
            ) : null}
            {showProfileLink ? (
              <a href="/account/settings?error=missing-player-profile" className="font-semibold text-[#12355b]">
                Complete player profile
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}

function useServiceSelection(onSelect: (service: SelectedService) => void) {
  useEffect(() => {
    function onServiceSelected(event: Event) {
      const detail = (event as CustomEvent<SelectedService>).detail;
      if (detail?.id && detail.title) {
        onSelect(detail);
      }
    }

    window.addEventListener("reppy:service-selected", onServiceSelected);
    return () => window.removeEventListener("reppy:service-selected", onServiceSelected);
  }, [onSelect]);
}

function useAvailabilitySelection(onSelect: (availability: SelectedAvailabilityPayload) => void) {
  useEffect(() => {
    function onAvailabilitySelected(event: Event) {
      const detail = (event as CustomEvent<SelectedAvailabilityPayload>).detail;
      if (detail?.date) {
        onSelect(detail);
      }
    }

    window.addEventListener("reppy:availability-selected", onAvailabilitySelected);
    return () => window.removeEventListener("reppy:availability-selected", onAvailabilitySelected);
  }, [onSelect]);
}

function formatSelectedAvailability(selection: SelectedAvailabilityPayload) {
  const [year, month, day] = selection.date.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!selection.startTime) {
    return `${dateLabel}. Add preferred times below.`;
  }

  return `${dateLabel}, ${formatTime(selection.startTime)} to ${formatTime(selection.endTime)} ${selection.timezone}`;
}

function formatTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  return new Date(2026, 0, 1, Number(hourText), Number(minuteText)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  textarea = false,
  autoComplete,
  inputMode,
  defaultValue = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  defaultValue?: string;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {required ? <span className="text-red-700"> *</span> : null}
      {textarea ? (
        <textarea
          id={name}
          name={name}
          required={required}
          rows={4}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          className={className}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          defaultValue={defaultValue}
          className={className}
        />
      )}
    </label>
  );
}
