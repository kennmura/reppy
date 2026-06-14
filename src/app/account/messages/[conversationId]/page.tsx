import { notFound } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { createTrainingPaymentCheckout, replyToConversationAsAccount, requestFutureTrainingSession } from "@/lib/actions";
import { getAccountUserOrRedirect } from "@/lib/auth";
import { getAccountConversationThread, getTrainingRequestBundleByConversation } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { formatMoney } from "@/lib/payments";
import type { Coach, TrainingRequest, TrainingRequestBundle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountMessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{
    payment?: string;
    payment_error?: string;
    session?: string;
    session_error?: string;
  }>;
}) {
  const user = await getAccountUserOrRedirect();
  const { conversationId } = await params;
  const query = await searchParams;
  const [notificationCount, thread, requestBundle] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountConversationThread({ userId: user.id, conversationId }),
    getTrainingRequestBundleByConversation(conversationId),
  ]);

  if (!thread) {
    notFound();
  }

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <RealtimeRefresh userId={user.id} conversationId={conversationId} />
      <div className="space-y-4">
        <PageMessage type="success" text={paymentSuccessMessage(query.payment)} />
        <PageMessage type="success" text={query.session === "requested" ? "Future session requested." : undefined} />
        <PageMessage type="error" text={paymentErrorMessage(query.payment_error)} />
        <PageMessage type="error" text={sessionErrorMessage(query.session_error)} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {thread.conversation.sport || "Training request"}
          </h1>
          <p className="mt-2 text-slate-600">
            {thread.conversation.request_type || "Training"} -{" "}
            {thread.conversation.general_location || "Area not provided"}
          </p>
          <p className="mt-4 rounded-md bg-[#f7f8f3] px-4 py-3 text-sm leading-6 text-slate-700">
            Normal conversation activity stays inside Reppy. Push notifications use generic text
            and do not include full private messages.
          </p>
        </section>

        <AccountPaymentPanel requestBundle={requestBundle} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {thread.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {message.sender_role} - {new Date(message.created_at).toLocaleString()}
                </p>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800">{message.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <form action={replyToConversationAsAccount} className="grid gap-3">
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
        </section>
      </div>
    </AccountShell>
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

function AccountPaymentPanel({ requestBundle }: { requestBundle: TrainingRequestBundle }) {
  const request = requestBundle.request;
  const coach = requestBundle.coach;
  const firstPayment = requestBundle.payments.find((payment) => payment.session_kind === "first_session");
  const openFuturePlatformPayment = requestBundle.payments.find(
    (payment) =>
      payment.session_kind === "future_session" &&
      payment.payment_method === "platform" &&
      ["requires_payment", "checkout_created"].includes(payment.status),
  );

  if (!request) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Booking and payment</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{request.service_title || "Training request"}</h2>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Meta label="Coach" value={coach?.full_name} />
        <Meta label="Requested time" value={formatRequestTime(request)} />
        <Meta label="Payment status" value={paymentStatusLabel(request.payment_status)} />
        <Meta label="Session price" value={formatMoney(request.gross_amount_cents, request.currency ?? "usd")} />
        <Meta label="Platform fee" value={formatMoney(request.platform_fee_cents, request.currency ?? "usd")} />
        <Meta label="Payment total" value={formatMoney(request.gross_amount_cents, request.currency ?? "usd")} />
      </div>
      {request.status === "accepted_pending_payment" && firstPayment ? (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">First session payment is required through Reppy to confirm your booking.</p>
          <p className="mt-2">
            Your booking is not confirmed until Stripe confirms payment through the Reppy webhook.
          </p>
          <form action={createTrainingPaymentCheckout} className="mt-4">
            <input type="hidden" name="payment_id" value={firstPayment.id} />
            <input type="hidden" name="conversation_id" value={request.conversation_id ?? ""} />
            <PendingSubmitButton
              idleLabel={firstPayment.status === "checkout_created" ? "Continue Stripe checkout" : "Pay through Reppy"}
              pendingLabel="Opening checkout..."
              className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
        </div>
      ) : null}
      {openFuturePlatformPayment ? (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">A future session is waiting for Reppy payment.</p>
          <form action={createTrainingPaymentCheckout} className="mt-4">
            <input type="hidden" name="payment_id" value={openFuturePlatformPayment.id} />
            <input type="hidden" name="conversation_id" value={request.conversation_id ?? ""} />
            <PendingSubmitButton
              idleLabel="Pay future session through Reppy"
              pendingLabel="Opening checkout..."
              className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
        </div>
      ) : null}
      {["paid_confirmed", "completed"].includes(request.status) ? (
        <FutureSessionForm request={request} coach={coach} />
      ) : null}
    </section>
  );
}

function FutureSessionForm({ request, coach }: { request: TrainingRequest; coach: Coach | null }) {
  const platformRequired = coach?.platform_payment_required === true;
  const platformAllowed = coach?.platform_payment_allowed !== false;
  const directPreferred = coach?.coach_direct_preferred !== false;

  return (
    <form action={requestFutureTrainingSession} className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="request_id" value={request.id} />
      <input type="hidden" name="conversation_id" value={request.conversation_id ?? ""} />
      <div>
        <h3 className="font-semibold text-slate-950">Book another session</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Future sessions may be paid directly to the coach or through Reppy, depending on coach preference.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Requested date" name="requested_date" type="date" />
        <Field label="Start time" name="requested_start_time" type="time" />
        <Field label="End time" name="requested_end_time" type="time" />
      </div>
      <Field label="Preferred days/times" name="preferred_days_times" defaultValue={request.preferred_days_times ?? ""} />
      <Field label="Location" name="location" defaultValue={request.preferred_location ?? ""} />
      <label className="text-sm font-medium text-slate-800">
        Notes
        <textarea
          name="notes"
          rows={3}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
        />
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-medium text-slate-800">Payment option</p>
        {platformRequired ? (
          <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-white px-3 py-2 text-sm">
            <input type="radio" name="payment_method" value="platform" defaultChecked />
            <span>Pay through Reppy</span>
          </label>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-white px-3 py-2 text-sm">
              <input type="radio" name="payment_method" value="coach_direct" defaultChecked={directPreferred} />
              <span>Pay coach directly</span>
            </label>
            {platformAllowed ? (
              <label className="flex gap-3 rounded-md border border-[#d7e5dc] bg-white px-3 py-2 text-sm">
                <input type="radio" name="payment_method" value="platform" defaultChecked={!directPreferred} />
                <span>Pay through Reppy</span>
              </label>
            ) : null}
          </div>
        )}
      </div>
      <PendingSubmitButton
        idleLabel="Request future session"
        pendingLabel="Sending..."
        className="w-fit rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
      />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
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

function paymentStatusLabel(status: TrainingRequest["payment_status"]) {
  return status?.replaceAll("_", " ") ?? "not required";
}

function paymentSuccessMessage(code?: string) {
  if (code === "success") {
    return "Stripe payment is processing. This page updates after the webhook confirms payment.";
  }

  if (code === "already-paid") {
    return "This session is already paid.";
  }

  return undefined;
}

function paymentErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    "missing-payment": "Payment record not found.",
    "missing-stripe-config": "Stripe checkout is not configured yet.",
    "not-found": "Payment record not found.",
    "not-platform": "This payment is not handled through Reppy.",
    "payouts-not-ready": "This coach needs to finish Stripe payout setup before Reppy payment can start.",
    "checkout-failed": "Stripe checkout could not be started. Please try again.",
  };

  return code ? messages[code] : undefined;
}

function sessionErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    "first-session-required": "The first session must be paid and confirmed before booking another session.",
    "coach-not-found": "Coach not found.",
    "missing-price": "This coach needs a service price before another session can be booked.",
  };

  return code ? messages[code] : undefined;
}
