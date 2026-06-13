import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";

export default async function AdminReportsPage() {
  await getAdminUserOrRedirect();
  return (
    <AdminLayout>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Reports</h1>
        <p className="mt-3 leading-7 text-slate-700">
          Report review workflows will use `message_reports` and moderation logs.
        </p>
      </div>
    </AdminLayout>
  );
}
