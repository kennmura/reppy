"use client";

import { useState } from "react";

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
  DUPLICATE_ACTIVE_REQUEST:
    "You already have an active request with this coach. Open your Message Center to continue the conversation.",
  RATE_LIMITED: "You are sending requests too quickly. Please wait and try again.",
};

export function RequestTrainingForm({ coachSlug = "ken-murakawa" }: { coachSlug?: string }) {
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState("");
  const [showAuthLinks, setShowAuthLinks] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setState("submitting");
    setError("");
    setShowAuthLinks(false);
    setConversationId("");

    try {
      const response = await fetch("/api/training-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, coach_slug: coachSlug, client_request_id: clientRequestId }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as TrainingRequestResponse | null)
        : null;

      if (!response.ok || !body?.success) {
        const code = body && !body.success ? body.error.code : "";
        setError(requestErrorMessages[code] ?? (body && !body.success ? body.error.message : "Something went wrong. Please try again."));
        setShowAuthLinks(code === "AUTH_REQUIRED");
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
      <input type="hidden" name="coach_slug" value={coachSlug} />
      <input type="hidden" name="client_request_id" value={clientRequestId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Player/parent name" name="name" required />
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
          </div>
        ) : null}
      </div>
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
