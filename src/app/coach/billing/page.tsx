import { CoachShell } from "@/components/coach/CoachShell";
import { TrialBanner } from "@/components/coach/TrialBanner";
import { activateCoachTrial } from "@/lib/actions";
import { getCoachContextOrRedirect } from "@/lib/auth";
import {
  redeemFreeCoachOfferAction,
  startCoachBillingPortalAction,
  startCoachPayoutOnboardingAction,
  startCoachSubscriptionCheckoutAction,
} from "@/lib/coachPromoActions";
import { durationLabel, getCoachBillingOfferState } from "@/lib/coachAccessOffers";
import { getCoachUnreadCount } from "@/lib/data";
import { getMessageAccess } from "@/lib/entitlements";
import { getUnreadNotificationCount } from "@/lib/notifications";
import type { CoachAccessOffer } from "@/lib/types";

export const dynamic = "force-dynamic";

const billingMessages: Record<string, string> = {
  "free-applied": "Free premium access has been applied to your account.",
  "checkout-success": "Stripe checkout completed. Premium access updates after the webhook confirms the subscription.",
  "checkout-cancelled": "Stripe checkout was cancelled.",
  "portal-return": "Returned from Stripe billing management.",
};

const billingErrors: Record<string, string> = {
  "free-offer-unavailable": "That free premium offer is not available for this account.",
  "not-eligible": "That offer is not available for this account.",
  "grant-failed": "Free access could not be applied. Try again or contact support.",
  "offer-update-failed": "The offer could not be marked as redeemed. Try again or contact support.",
  "invalid-plan": "Choose a valid subscription plan.",
  "founding-not-eligible": "The founding rate is not available for this account.",
  "missing-stripe-config": "Stripe subscription checkout is not configured yet.",
  "founding-claim-failed": "The founding offer could not be claimed for this account.",
  "checkout-failed": "Stripe checkout could not be started. Try again later.",
  "missing-customer": "Start a paid subscription before opening billing management.",
  "portal-failed": "Stripe billing management could not be opened. Try again later.",
  "connect-failed": "Stripe payout onboarding could not be started. Try again later.",
  "connect-save-failed": "Stripe payout account could not be saved. Try again later.",
};

export default async function CoachBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; billing?: string; billing_error?: string }>;
}) {
  const params = await searchParams;
  const { user, coach, coachUserId } = await getCoachContextOrRedirect();
  const [access, unreadCount, notificationCount, offerState] = await Promise.all([
    getMessageAccess({ coach, coachUserId }),
    getCoachUnreadCount(coach.id, coachUserId),
    getUnreadNotificationCount(user.id),
    getCoachBillingOfferState({
      userId: user.id,
      email: user.email,
      coach,
      inviteToken: params.invite,
    }),
  ]);

  return (
    <CoachShell userId={user.id} unreadCount={unreadCount} notificationCount={notificationCount} access={access}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Billing</h1>
          <p className="mt-2 text-slate-600">Manage coach premium access, subscription checkout, and private offers.</p>
        </div>
        {params.billing && billingMessages[params.billing] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {billingMessages[params.billing]}
          </p>
        ) : null}
        {params.billing_error && billingErrors[params.billing_error] ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {billingErrors[params.billing_error]}
          </p>
        ) : null}
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
        </section>

        {offerState.freeOffer ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Approved offer</p>
            <h2 className="mt-3 text-2xl font-semibold text-emerald-950">You have free premium access from Reppy.</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              {offerState.freeOffer.is_lifetime
                ? "Lifetime access."
                : `Access expires: ${formatDate(offerState.freeOffer.expires_at)}.`}
            </p>
            {!access.hasAccess ? (
              <form action={redeemFreeCoachOfferAction} className="mt-5">
                <input type="hidden" name="invite_token" value={params.invite ?? ""} />
                <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                  Apply free premium
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {offerState.foundingOffer ? (
          <section className="rounded-lg border border-[#d7e2cc] bg-[#f7f8f3] p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Private founding offer</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              You&apos;re eligible for the founding coach rate: $5.99/month.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              This offer is tied to your approved email.{" "}
              {offerState.foundingOffer.is_lifetime
                ? "This rate remains active while your subscription remains active."
                : `This rate applies for ${durationLabel(offerState.foundingOffer.duration_type)}, then renews at $15.99/month.`}
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <PlanCard
            title="Premium monthly"
            price="$15.99"
            cadence="/month"
            body="Premium Message Center access with normal monthly billing."
            planCode="premium_monthly"
            inviteToken={params.invite}
          />
          <PlanCard
            title="Premium annual"
            price="$160.99"
            cadence="/year"
            body="Premium access with yearly billing."
            planCode="premium_annual"
            inviteToken={params.invite}
          />
          {offerState.foundingOffer ? (
            <PlanCard
              title="Founding rate"
              price="$5.99"
              cadence="/month"
              body={foundingPlanBody(offerState.foundingOffer)}
              planCode="founding_599"
              inviteToken={params.invite}
            />
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Billing management</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Manage payment methods, invoices, and subscription cancellation through Stripe.
            </p>
            <form action={startCoachBillingPortalAction} className="mt-5">
              <button className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500">
                Open Stripe billing
              </button>
            </form>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Payout setup</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Set up Stripe Connect Express for payouts. Bank and payout details stay with Stripe.
            </p>
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Status: {coach.stripe_connected_account_id ? "Stripe account created" : "Not started"}
            </p>
            <form action={startCoachPayoutOnboardingAction} className="mt-5">
              <button className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500">
                Set up payouts
              </button>
            </form>
          </article>
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

function PlanCard({
  title,
  price,
  cadence,
  body,
  planCode,
  inviteToken,
}: {
  title: string;
  price: string;
  cadence: string;
  body: string;
  planCode: "premium_monthly" | "premium_annual" | "founding_599";
  inviteToken?: string | null;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
        {price}
        <span className="ml-1 text-base font-medium text-slate-500">{cadence}</span>
      </p>
      <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{body}</p>
      <form action={startCoachSubscriptionCheckoutAction} className="mt-6">
        <input type="hidden" name="plan_code" value={planCode} />
        <input type="hidden" name="invite_token" value={inviteToken ?? ""} />
        <button className="w-full rounded-md bg-[#12355b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
          Continue to Stripe
        </button>
      </form>
    </article>
  );
}

function foundingPlanBody(offer: CoachAccessOffer) {
  if (offer.is_lifetime) {
    return "Private founding rate while your subscription remains active.";
  }

  return `${durationLabel(offer.duration_type)} at $5.99/month, then renews at $15.99/month.`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Lifetime access";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
