import { AdminLayout } from "@/components/AdminLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { deleteTrainingRequest, updateRequestStatus } from "@/lib/actions";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminTrainingRequests } from "@/lib/data";
import type { TrainingRequest } from "@/lib/types";

const statuses: TrainingRequest["status"][] = ["pending", "accepted", "declined", "cancelled", "completed"];

export default async function AdminRequestsPage() {
  await getAdminUserOrRedirect();
  const requests = await getAdminTrainingRequests();

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Training requests</h1>
        <p className="mt-2 text-slate-600">Private inquiries are visible only in admin.</p>
        <div className="mt-6 space-y-4">
          {requests.length ? (
            requests.map((request) => <RequestPanel key={request.id} request={request} />)
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No requests yet.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function RequestPanel({ request }: { request: TrainingRequest }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-950">{request.name}</h2>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {request.email}
            {request.phone ? ` · ${request.phone}` : ""}
          </p>
        </div>
        <p className="text-sm text-slate-500">{new Date(request.created_at).toLocaleString()}</p>
      </div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Player age" value={request.player_age_at_request?.toString() ?? request.player_age} />
        <Detail label="Requested time" value={formatRequestedTime(request)} />
        <Detail label="Current level/team" value={request.current_level} />
        <Detail label="Preferred location" value={request.preferred_location} />
        <Detail label="Preferred days/times" value={request.preferred_days_times} />
        <Detail label="Training goals" value={request.training_goals} wide />
        <Detail label="Message" value={request.message} wide />
      </dl>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form action={updateRequestStatus} className="flex gap-2">
          <input type="hidden" name="id" value={request.id} />
          <select
            name="status"
            defaultValue={request.status}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-[#12355b] px-3 py-2 text-sm font-semibold text-white">
            Update
          </button>
        </form>
        <form action={deleteTrainingRequest}>
          <input type="hidden" name="id" value={request.id} />
          <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{value || "Not provided"}</dd>
    </div>
  );
}

function formatRequestedTime(request: TrainingRequest) {
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
