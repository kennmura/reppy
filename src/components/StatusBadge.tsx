import type { TrainingRequest } from "@/lib/types";

const labels: Record<TrainingRequest["status"], string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  closed: "Closed",
};

const styles: Record<TrainingRequest["status"], string> = {
  new: "bg-blue-50 text-blue-800 ring-blue-200",
  contacted: "bg-amber-50 text-amber-800 ring-amber-200",
  scheduled: "bg-green-50 text-green-800 ring-green-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ status }: { status: TrainingRequest["status"] }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
