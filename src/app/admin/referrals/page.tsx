import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";

export default async function AdminReferralsPage() {
  await getAdminUserOrRedirect();
  return (
    <AdminLayout>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Referrals</h1>
        <p className="mt-3 leading-7 text-slate-700">
          Referral qualification and premium access grants can be reviewed here as the referral
          workflow becomes automated.
        </p>
      </div>
    </AdminLayout>
  );
}
