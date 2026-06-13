import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoachApplications, getAdminCoaches, getAdminTrainingRequests } from "@/lib/data";

export default async function AdminPage() {
  await getAdminUserOrRedirect();
  const [requests, coaches, applications] = await Promise.all([
    getAdminTrainingRequests(),
    getAdminCoaches(),
    getAdminCoachApplications(),
  ]);
  const newRequests = requests.filter((request) => request.status === "new").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage training inquiries and coach profile content.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Total requests" value={requests.length} />
          <Metric label="New requests" value={newRequests} />
          <Metric label="Coach profiles" value={coaches.length} />
          <Metric label="Coach leads" value={applications.length} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminLink href="/admin/requests" title="Review requests" body="View inquiry details, update status, and remove spam." />
          <AdminLink href="/admin/coaches" title="Manage coaches" body="Edit profile fields and publish settings." />
          <AdminLink href="/admin/coach-applications" title="Coach leads" body="Review coaches who asked to get on the directory radar." />
        </div>
      </div>
    </AdminLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function AdminLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </Link>
  );
}
