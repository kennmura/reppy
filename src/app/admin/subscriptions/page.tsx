import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { createPremiumAccessGrant, deactivatePremiumAccessGrant } from "@/lib/actions";
import { getAdminCoaches, getAdminPremiumAccessGrants } from "@/lib/data";

const messages: Record<string, string> = {
  created: "Premium access grant created.",
  deactivated: "Premium access grant deactivated.",
};

const errors: Record<string, string> = {
  "missing-coach": "Select a coach before creating a grant.",
  "missing-coach-user": "That coach is not connected to a Coach Account yet.",
  "missing-grant": "Grant id is missing.",
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ grant?: string; error?: string }>;
}) {
  await getAdminUserOrRedirect();
  const params = await searchParams;
  const [coaches, grants] = await Promise.all([getAdminCoaches(), getAdminPremiumAccessGrants()]);
  const coachesById = new Map(coaches.map((coach) => [coach.id, coach]));

  return (
    <AdminLayout>
      <div className="grid gap-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Subscriptions</h1>
        <p className="mt-3 leading-7 text-slate-700">
          Subscription state, founding-price locks, trial state, and access grants are checked by the
          server-side Message Center entitlement function.
        </p>
      </div>
        {params.grant && messages[params.grant] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {messages[params.grant]}
          </p>
        ) : null}
        {params.error && errors[params.error] ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors[params.error]}
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Manual beta / premium grant</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this for beta access, manual comped access, or support fixes before automated billing
            is connected.
          </p>
          <form action={createPremiumAccessGrant} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Coach
              <select
                name="coach_id"
                required
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="">Select coach</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.full_name} {coach.user_id ? "" : "(no account linked)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Grant type
              <select
                name="grant_type"
                defaultValue="manual"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="manual">Manual premium</option>
                <option value="beta">Beta access</option>
                <option value="trial">Trial extension</option>
                <option value="support">Support grant</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Ends at
              <input
                name="ends_at"
                type="datetime-local"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
              <span className="mt-1 block text-xs text-slate-500">Leave blank for indefinite access.</span>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Notes
              <input
                name="notes"
                placeholder="Optional admin note"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Create grant
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Access grants</h2>
          {grants.length ? (
            <div className="mt-5 divide-y divide-slate-200">
              {grants.map((grant) => {
                const coach = grant.coach_id ? coachesById.get(grant.coach_id) : null;
                const active = grant.is_active !== false;

                return (
                  <div key={grant.id} className="grid gap-3 py-4 lg:grid-cols-[1.2fr_0.7fr_0.9fr_auto] lg:items-center">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {coach?.full_name ?? grant.user_id ?? grant.coach_user_id ?? "Unknown coach"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{grant.notes || "No note"}</p>
                    </div>
                    <p className="text-sm capitalize text-slate-700">{grant.grant_type.replaceAll("_", " ")}</p>
                    <p className="text-sm text-slate-700">
                      {active ? "Active" : "Inactive"} - {grant.ends_at ? new Date(grant.ends_at).toLocaleString() : "Indefinite"}
                    </p>
                    {active ? (
                      <form action={deactivatePremiumAccessGrant}>
                        <input type="hidden" name="grant_id" value={grant.id} />
                        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500">
                          Deactivate
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No manual premium grants yet.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
