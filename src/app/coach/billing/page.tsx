import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { activateCoachTrial } from "@/lib/actions";
import { getCoachContextOrRedirect } from "@/lib/auth";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export default async function CoachBillingPage() {
  const { coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id),
  ]);

  return (
    <CoachShell unreadCount={unreadCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Billing</h1>
          <p className="mt-2 text-slate-600">
            Subscription checkout and billing portal hooks are prepared for hosted billing.
          </p>
        </div>
        <TrialBanner access={access} />
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Current plan
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            {access.hasAccess ? "Premium Messaging" : "Free Coach Plan"}
          </h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <BillingDetail label="Subscription status" value={access.status} />
            <BillingDetail
              label="Founding price"
              value={access.foundingPriceLocked ? "Locked" : "Not locked"}
            />
            <BillingDetail label="Trial ends" value={access.trialEndsAt} />
            <BillingDetail label="Access ends" value={access.accessEndsAt} />
          </dl>
          {!access.hasAccess ? (
            <form action={activateCoachTrial} className="mt-6">
              <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Start Free Trial
              </button>
            </form>
          ) : null}
          <p className="mt-6 text-sm leading-6 text-slate-600">
            Hosted checkout, billing-management sessions, cancellation, and webhook processing should
            be wired to a payment provider before public launch. Browser redirects are not treated as
            proof of payment.
          </p>
        </section>
      </div>
    </CoachShell>
  );
}

function BillingDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="mt-1 text-slate-700">{value || "Not set"}</dd>
    </div>
  );
}
