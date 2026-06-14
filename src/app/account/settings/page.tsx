import { AccountShell } from "@/components/account/AccountShell";
import { updateAccountProfile } from "@/lib/actions";
import { getAccountContextOrRedirect, getAccountPrivateDetails } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getAccountContextOrRedirect();
  const [notificationCount, privateDetails] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountPrivateDetails(user.id),
  ]);
  const emailVerified = Boolean(user.email_confirmed_at || profile.email_verified_at);
  const phoneVerified = Boolean(privateDetails?.phone_verified_at || profile.phone_verified_at || user.phone_confirmed_at);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Account settings</h1>
        <p className="mt-2 text-slate-600">Manage your account name and profile details.</p>
        {params.saved ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Settings saved.
          </p>
        ) : null}
        {params.error === "missing-name" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Enter a display name.
          </p>
        ) : null}
        <form action={updateAccountProfile} className="mt-6 grid max-w-xl gap-4">
          <label className="text-sm font-medium text-slate-800">
            Display name
            <input
              name="display_name"
              defaultValue={profile.display_name}
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            />
          </label>
          <button className="w-fit rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
            Save settings
          </button>
        </form>
        <div className="mt-8 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <Status label="Email verified" active={emailVerified} />
          <Status label="Phone verified" active={phoneVerified} />
        </div>
        <div className="mt-5 text-sm text-slate-700">
          {phoneVerified ? (
            <p>Verified phone: {privateDetails?.phone_e164 ?? "Stored in Supabase Auth"}</p>
          ) : (
            <a href="/account/verify-phone" className="font-semibold text-[#12355b]">
              Verify your phone
            </a>
          )}
        </div>
      </section>
    </AccountShell>
  );
}

function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className={`mt-1 text-sm ${active ? "text-emerald-700" : "text-amber-700"}`}>
        {active ? "Verified" : "Verification required"}
      </p>
    </div>
  );
}
