import { notFound } from "next/navigation";
import {
  addConversationToPlayers,
  acceptTrainingRequest,
  declineTrainingRequest,
  markDirectPaymentReceived,
  replyToConversation,
  toggleConversationSaved,
} from "@/lib/actions";
import { CoachShell } from "@/components/coach/CoachShell";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { StatusBadge } from "@/components/StatusBadge";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachConversationThread, getCoachUnreadCount, getTrainingRequestBundleByConversation } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { formatMoney } from "@/lib/payments";
import type { TrainingRequest, TrainingRequestBundle, TrainingRequestPayment } from "@/lib/types";

export const dynamic = "force-dynamic";

const requestMessages: Record<string, string> = {
  accepted: "Request accepted. The parent/player now has a Reppy payment link.",
  declined: "Request declined.",
};

const requestErrors: Record<string, string> = {
  "missing-price": "Add a service price before accepting. First-session payment has to be collected through Reppy.",
  "not-found": "Request not found.",
  "not-pending": "This request is no longer pending.",
  "not-actionable": "This request cannot be updated from its current status.",
};

const paymentMessages: Record<string, string> = {
  "direct-received": "Direct payment marked received.",
};

const paymentErrors: Record<string, string> = {
  "missing-payment": "Payment record not found.",
  "not-actionable": "This payment cannot be marked received.",
};

export default async function CoachMessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ request?: string; request_error?: string; payment?: string; payment_error?: string }>;
}) {
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const { conversationId } = await params;
  const query = await searchParams;
  const [access, unreadCount, notificationCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
  ]);
  const thread = await getCoachConversationThread({
    coachId: coach.id,
    coachUserId,
    conversationId,
    includePrivate: true,
  });
  const requestBundle = await getTrainingRequestBundleByConversation(conversationId);

  if (!thread) {
    notFound();
  }

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <RealtimeRefresh userId={user.id} conversationId={conversationId} />
      <div className="space-y-4">
        <TrialBanner access={access} />
        <PageMessage type="success" text={query.request ? requestMessages[query.request] : undefined} />
        <PageMessage type="success" text={query.payment ? paymentMessages[query.payment] : undefined} />
        <PageMessage type="error" text={query.request_error ? requestErrors[query.request_error] : undefined} />
        <PageMessage type="error" text={query.payment_error ? paymentErrors[query.payment_error] : undefined} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {thread.privateDetails?.requester_display_name || "Training request"}
              </h1>
              <p className="mt-2 text-slate-600">
                {thread.conversation.sport} · Ages {thread.conversation.age_range} ·{" "}
                {thread.conversation.general_location}
              </p>
            </div>
            <form action={toggleConversationSaved}>
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
              <input type="hidden" name="is_saved" value={String(!thread.conversation.is_saved)} />
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
                {thread.conversation.is_saved ? "Unsave" : "Save"}
              </button>
            </form>
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
            <Meta label="Service" value={thread.privateDetails?.service_title} />
            <Meta label="Requested time" value={formatRequestedTime(thread.privateDetails)} />
            <Meta label="Player age" value={thread.privateDetails?.player_age_at_request?.toString()} />
            <Meta label="Club/team" value={thread.privateDetails?.current_team} />
            <Meta label="Current level" value={thread.privateDetails?.current_level} />
            <Meta label="Preferred days/times" value={thread.privateDetails?.preferred_days_times} />
            <Meta label="Guardian" value={thread.privateDetails?.guardian_name} />
          </div>
          <p className="mt-5 rounded-md bg-[#f7f8f3] px-4 py-3 text-sm leading-6 text-slate-700">
            Unsaved conversations are deleted 90 days after their most recent activity. Save this
            conversation if you need to preserve it longer.
          </p>
        </section>

        <CoachRequestPanel requestBundle={requestBundle} conversationId={thread.conversation.id} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {thread.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {message.sender_role} · {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800">{message.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_260px]">
          <form action={replyToConversation} className="grid gap-3">
            <input type="hidden" name="conversation_id" value={thread.conversation.id} />
            <label className="text-sm font-medium text-slate-800">
              Reply
              <textarea
                name="body"
                required
                rows={5}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <PendingSubmitButton
              idleLabel="Send reply"
              pendingLabel="Sending..."
              className="w-fit rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
          <div className="space-y-3">
            <form action={addConversationToPlayers}>
              <input type="hidden" name="conversation_id" value={thread.conversation.id} />
              <PendingSubmitButton
                idleLabel="Add to My Players"
                pendingLabel="Adding..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </form>
          </div>
        </section>
      </div>
    </CoachShell>
  );
}

function PageMessage({ type, text }: { type: "success" | "error"; text?: string }) {
  if (!text) {
    return null;
  }

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {text}
    </div>
  );
}

function CoachRequestPanel({
  requestBundle,
  conversationId,
}: {
  requestBundle: TrainingRequestBundle;
  conversationId: string;
}) {
  const request = requestBundle.request;
  const directPendingPayments = requestBundle.payments.filter(
    (payment) => payment.payment_method === "coach_direct" && payment.status === "coach_direct_pending",
  );

  if (!request) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Request management</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{request.service_title || "Training request"}</h2>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Meta label="Payment status" value={paymentStatusLabel(request.payment_status)} />
        <Meta label="Payment method" value={paymentMethodLabel(request.payment_method)} />
        <Meta label="Session price" value={formatMoney(request.gross_amount_cents, request.currency ?? "usd")} />
        <Meta label="Requested time" value={formatRequestTime(request)} />
        <Meta label="Preferred days/times" value={request.preferred_days_times} />
        <Meta label="Training goals" value={request.training_goals} />
      </div>
      {request.status === "pending" ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form action={acceptTrainingRequest} className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] p-4">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="conversation_id" value={conversationId} />
            <p className="text-sm leading-6 text-slate-700">
              Accepting creates the first-session payment requirement. The booking is not confirmed until Stripe webhook payment confirmation.
            </p>
            <PendingSubmitButton
              idleLabel="Accept and request payment"
              pendingLabel="Accepting..."
              className="mt-4 rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
          <form action={declineTrainingRequest} className="rounded-md border border-red-100 bg-red-50 p-4">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="conversation_id" value={conversationId} />
            <label className="text-sm font-medium text-slate-800">
              Optional decline note
              <textarea
                name="decline_reason"
                rows={3}
                className="mt-2 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>
            <PendingSubmitButton
              idleLabel="Decline request"
              pendingLabel="Declining..."
              className="mt-3 rounded-md border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
        </div>
      ) : null}
      {request.status === "accepted_pending_payment" ? (
        <p className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Waiting for the parent/player to pay through Reppy. The first session is not confirmed yet.
        </p>
      ) : null}
      {request.status === "paid_confirmed" ? (
        <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          First session payment is confirmed. This booking can be treated as confirmed.
        </p>
      ) : null}
      {directPendingPayments.length ? (
        <div className="mt-5 grid gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Direct payments</h3>
          {directPendingPayments.map((payment) => (
            <DirectPaymentRow key={payment.id} payment={payment} conversationId={conversationId} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DirectPaymentRow({
  payment,
  conversationId,
}: {
  payment: TrainingRequestPayment;
  conversationId: string;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{payment.service_title || "Future session"}</p>
          <p className="mt-1">{formatMoney(payment.gross_amount_cents, payment.currency)} direct to coach</p>
        </div>
        <form action={markDirectPaymentReceived}>
          <input type="hidden" name="payment_id" value={payment.id} />
          <input type="hidden" name="conversation_id" value={conversationId} />
          <PendingSubmitButton
            idleLabel="Mark paid"
            pendingLabel="Saving..."
            className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          />
        </form>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value || "Not provided"}</p>
    </div>
  );
}

function formatRequestedTime(privateDetails: {
  requested_date?: string | null;
  requested_start_time?: string | null;
  requested_end_time?: string | null;
  timezone?: string | null;
} | null) {
  if (!privateDetails?.requested_date) {
    return null;
  }

  const [year, month, day] = privateDetails.requested_date.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!privateDetails.requested_start_time) {
    return dateLabel;
  }

  return `${dateLabel}, ${formatTime(privateDetails.requested_start_time)} to ${formatTime(privateDetails.requested_end_time ?? "")} ${privateDetails.timezone ?? ""}`.trim();
}

function formatRequestTime(request: TrainingRequest) {
  if (!request.requested_date) {
    return null;
  }

  const [year, month, day] = request.requested_date.split("-").map(Number);
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (!request.requested_start_time) {
    return dateLabel;
  }

  return `${dateLabel}, ${formatTime(request.requested_start_time)} to ${formatTime(request.requested_end_time ?? "")} ${request.timezone ?? ""}`.trim();
}

function paymentStatusLabel(status: TrainingRequest["payment_status"]) {
  return status?.replaceAll("_", " ") ?? "not required";
}

function paymentMethodLabel(method: TrainingRequest["payment_method"]) {
  if (method === "platform") {
    return "Pay through Reppy";
  }

  if (method === "coach_direct") {
    return "Pay coach directly";
  }

  return "Not selected";
}

function formatTime(value: string) {
  if (!value) {
    return "";
  }

  const [hourText, minuteText] = value.split(":");
  return new Date(2026, 0, 1, Number(hourText), Number(minuteText)).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
