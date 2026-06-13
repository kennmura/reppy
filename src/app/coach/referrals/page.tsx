import { CoachShell } from "@/components/coach/CoachShell";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function CoachReferralsPage() {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
  ]);
  const referralCode = coach.referral_code || coach.slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const referralUrl = appUrl(`/signup/coach?ref=${referralCode}`);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Referrals</h1>
          <p className="mt-2 text-slate-600">
            Refer a coach and you can both receive one month of Premium access.
          </p>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Referral link
          </p>
          <p className="mt-3 break-all rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {referralUrl}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Referral rewards are currently tracked in the entitlement ledger and may be administered
            manually from admin until automated billing credits are complete.
          </p>
        </section>
      </div>
    </CoachShell>
  );
}
