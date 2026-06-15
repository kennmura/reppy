import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPassportDashboard } from "@/lib/passportData";

export const dynamic = "force-dynamic";

export default async function AdminPassportPlayersPage() {
  await getAdminUserOrRedirect();
  const { players } = await getAdminPassportDashboard();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Passport Players</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Player profiles</h1>
          <p className="mt-2 text-slate-600">Support view for profile status, sport, visibility, and team readiness.</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Sport</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Minor</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">{player.display_name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{player.sport}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{player.visibility}</td>
                  <td className="px-4 py-3 text-slate-600">{player.is_minor ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(player.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
