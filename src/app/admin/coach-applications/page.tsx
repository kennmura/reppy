import { AdminLayout } from "@/components/AdminLayout";
import { updateCoachApplicationStatus } from "@/lib/actions";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoachApplications } from "@/lib/data";
import type { CoachApplication } from "@/lib/types";

const statuses: CoachApplication["status"][] = ["new", "reviewing", "approved", "closed"];

export default async function AdminCoachApplicationsPage() {
  await getAdminUserOrRedirect();
  const applications = await getAdminCoachApplications();

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coach leads</h1>
        <p className="mt-2 text-slate-600">
          Coaches who submitted the public registration form.
        </p>
        <div className="mt-6 space-y-4">
          {applications.length ? (
            applications.map((application) => (
              <article
                key={application.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">
                      {application.full_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {application.sport} · {application.location}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {application.email}
                      {application.phone ? ` · ${application.phone}` : ""}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    {new Date(application.created_at).toLocaleString()}
                  </p>
                </div>
                <dl className="mt-5 grid gap-4 text-sm">
                  <Detail label="Coaching focus" value={application.coaching_focus} />
                  <Detail label="Background" value={application.background} />
                  <Detail label="Message" value={application.message} />
                </dl>
                <form action={updateCoachApplicationStatus} className="mt-5 flex gap-2">
                  <input type="hidden" name="id" value={application.id} />
                  <select
                    name="status"
                    defaultValue={application.status}
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
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
              No coach leads yet.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{value || "Not provided"}</dd>
    </div>
  );
}
