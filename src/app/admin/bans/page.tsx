import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";

export default async function AdminBansPage() {
  await getAdminUserOrRedirect();
  return (
    <AdminLayout>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Bans</h1>
        <p className="mt-3 leading-7 text-slate-700">
          Banned identifiers are stored as normalized hashes where practical to prevent reuse of the
          same verified email or phone number.
        </p>
      </div>
    </AdminLayout>
  );
}
