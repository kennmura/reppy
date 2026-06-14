import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoaches, getAdminTrainingRequests } from "@/lib/data";

export default async function AdminPage() {
  await getAdminUserOrRedirect();
  const [requests, coaches] = await Promise.all([
    getAdminTrainingRequests(),
    getAdminCoaches(),
  ]);
  const pendingProfiles = coaches.filter((coach) => coach.profile_status === "pending_review").length;
  const publishedCoaches = coaches.filter((coach) => coach.is_published).length;
  const draftCoaches = coaches.filter((coach) => !coach.is_published && (coach.profile_status ?? "draft") === "draft").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-slate-600">Manage training inquiries and coach profile content.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Pending profiles" value={pendingProfiles} />
          <Metric label="Published coaches" value={publishedCoaches} />
          <Metric label="Draft coaches" value={draftCoaches} />
          <Metric label="Training requests" value={requests.length} />
          <Metric label="Reports" value={0} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminLink href="/admin/requests" title="Review requests" body="View inquiry details, update status, and remove spam." />
          <AdminLink href="/admin/coaches" title="Manage coaches" body="Edit profile fields and publish settings." />
          <AdminLink href="/admin/coach-applications" title="Applications" body="Review coaches who asked to get on the directory radar." />
          <AdminLink href="/admin/reports" title="Reports" body="Review message and safety reports." />
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
