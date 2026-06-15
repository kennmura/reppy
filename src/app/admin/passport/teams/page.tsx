import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPassportDashboard } from "@/lib/passportData";

export const dynamic = "force-dynamic";

export default async function AdminPassportTeamsPage() {
  await getAdminUserOrRedirect();
  const { teams, invites } = await getAdminPassportDashboard();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Passport Teams</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Teams and roster invites</h1>
          <p className="mt-2 text-slate-600">Support view for team ownership, join codes, and invite status.</p>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Teams</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {teams.map((team) => (
              <div key={team.id} className="grid gap-1 py-3 sm:grid-cols-4">
                <p className="font-semibold text-slate-950">{team.name}</p>
                <p className="capitalize text-slate-600">{team.sport}</p>
                <p className="text-slate-600">{team.join_code}</p>
                <p className="capitalize text-slate-600">{team.status}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Recent invites</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {invites.map((invite) => (
              <div key={invite.id} className="grid gap-1 py-3 sm:grid-cols-4">
                <p className="font-semibold text-slate-950">{invite.player_name}</p>
                <p className="text-slate-600">{invite.team_name || invite.team_id}</p>
                <p className="capitalize text-slate-600">{invite.status}</p>
                <p className="text-slate-600">{invite.parent_email_normalized || invite.player_school_email_normalized || invite.player_personal_email_normalized}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
