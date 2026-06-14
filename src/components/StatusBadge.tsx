import type { TrainingRequest } from "@/lib/types";

const labels: Record<TrainingRequest["status"], string> = {
  pending: "Pending coach action",
  accepted_pending_payment: "Pending payment",
  paid_confirmed: "Paid confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
  refunded: "Refunded",
};

const styles: Record<TrainingRequest["status"], string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted_pending_payment: "bg-blue-50 text-blue-800 ring-blue-200",
  paid_confirmed: "bg-green-50 text-green-800 ring-green-200",
  declined: "bg-red-50 text-red-800 ring-red-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  completed: "bg-green-50 text-green-800 ring-green-200",
  refunded: "bg-purple-50 text-purple-800 ring-purple-200",
};

export function StatusBadge({ status }: { status: TrainingRequest["status"] }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
