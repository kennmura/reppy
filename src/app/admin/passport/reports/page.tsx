import { AdminLayout } from "@/components/AdminLayout";
import { moderatePassportReportAction } from "@/lib/passportActions";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPassportDashboard } from "@/lib/passportData";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function AdminPassportReportsPage() {
  await getAdminUserOrRedirect();
  const { reports } = await getAdminPassportDashboard();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Passport Reports</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Reported content</h1>
          <p className="mt-2 text-slate-600">Moderate unsafe Passport content. Do not expose private DOB, emails, phone, or parent details.</p>
        </div>
        <div className="grid gap-4">
          {reports.map((report) => (
            <article key={report.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6f5e]">{report.content_type.replaceAll("_", " ")}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">{report.reason.replaceAll("_", " ")}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{report.details || "No extra details provided."}</p>
                  <p className="mt-2 text-xs text-slate-500">Status: {report.status}</p>
                </div>
                <form action={moderatePassportReportAction} className="grid gap-2 sm:w-64">
                  <input type="hidden" name="report_id" value={report.id} />
                  <input type="hidden" name="return_to" value="/admin/passport/reports" />
                  <select name="status" defaultValue={report.status === "open" ? "reviewing" : report.status} className={inputClass}>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <textarea name="admin_notes" rows={3} defaultValue={report.admin_notes ?? ""} placeholder="Admin notes" className={inputClass} />
                  <button className="rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]">Update</button>
                </form>
              </div>
            </article>
          ))}
          {!reports.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">No Passport reports</h2>
              <p className="mt-2 text-slate-600">Reported profiles, clips, comments, feedback, and handoff summaries will appear here.</p>
            </section>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}
