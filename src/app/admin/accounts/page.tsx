import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPlayerAccounts } from "@/lib/data";
import type { AdminAccountSummary } from "@/lib/types";

export default async function AdminAccountsPage() {
  await getAdminUserOrRedirect();
  const accounts = await getAdminPlayerAccounts();
  const parentCount = accounts.filter((account) => account.role === "parent").length;
  const adultPlayerCount = accounts.filter((account) => account.role === "adult_player").length;
  const verifiedEmailCount = accounts.filter(
    (account) => account.email_verified_at || account.auth_user?.email_confirmed_at,
  ).length;
  const verifiedPhoneCount = accounts.filter((account) => account.phone_verified_at).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Player/parent accounts</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Read-only testing view for parent and adult player accounts. This does not impersonate
            users or expose passwords.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Parent accounts" value={parentCount} />
          <Metric label="Adult players" value={adultPlayerCount} />
          <Metric label="Email verified" value={verifiedEmailCount} />
          <Metric label="Phone verified" value={verifiedPhoneCount} />
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_0.9fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Verified</span>
            <span>Action</span>
          </div>
          {accounts.length ? (
            accounts.map((account) => <AccountRow key={account.id} account={account} />)
          ) : (
            <p className="p-6 text-sm leading-6 text-slate-600">No player or parent accounts yet.</p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function AccountRow({ account }: { account: AdminAccountSummary }) {
  const emailVerified = Boolean(account.email_verified_at || account.auth_user?.email_confirmed_at);
  const phoneVerified = Boolean(account.phone_verified_at || account.auth_user?.phone_confirmed_at);

  return (
    <div className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_0.9fr_auto] lg:items-center">
      <div>
        <MobileLabel>Name</MobileLabel>
        <h2 className="font-semibold text-slate-950">{account.display_name || "Unnamed account"}</h2>
        <p className="mt-1 text-xs text-slate-500">{account.id}</p>
      </div>
      <AdminValue label="Email" value={account.auth_user?.email ?? "Not available"} />
      <AdminValue label="Role" value={account.role.replace("_", " ")} capitalize />
      <div>
        <MobileLabel>Status</MobileLabel>
        <Badge tone={account.account_status === "active" ? "green" : "gray"}>
          {account.account_status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <MobileLabel>Verified</MobileLabel>
        <Badge tone={emailVerified ? "green" : "gray"}>Email</Badge>
        <Badge tone={phoneVerified ? "green" : "gray"}>Phone</Badge>
      </div>
      <Link
        href={`/admin/accounts/${account.id}`}
        className="inline-flex w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
      >
        View
      </Link>
    </div>
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

function AdminValue({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <MobileLabel>{label}</MobileLabel>
      <p className={`text-sm text-slate-700 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:hidden">{children}</p>;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
        tone === "green"
          ? "border-[#d7e5dc] bg-[#f3f8f5] text-[#2f6f5e]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}
