import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { PassportMetric } from "@/components/passport/PassportComponents";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPassportDashboard } from "@/lib/passportData";

export const dynamic = "force-dynamic";

export default async function AdminPassportPage() {
  await getAdminUserOrRedirect();
  const dashboard = await getAdminPassportDashboard();
  const openReports = dashboard.reports.filter((report) => report.status === "open").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Reppy Passport</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Passport admin</h1>
          <p className="mt-2 text-slate-600">Moderate player profiles, team rosters, clips, feedback, handoff summaries, and reports.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <PassportMetric label="Players" value={dashboard.players.length} />
          <PassportMetric label="Teams" value={dashboard.teams.length} />
          <PassportMetric label="Roster invites" value={dashboard.invites.length} />
          <PassportMetric label="Open reports" value={openReports} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <AdminLink href="/admin/passport/players" title="Players" body="Review public/private status without exposing private details publicly." />
          <AdminLink href="/admin/passport/teams" title="Teams" body="Inspect team roster and invite status." />
          <AdminLink href="/admin/passport/reports" title="Reports" body="Resolve reported clips, feedback, profiles, and handoff summaries." />
        </div>
      </div>
    </AdminLayout>
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
