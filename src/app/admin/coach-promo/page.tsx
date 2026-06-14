import { AdminLayout } from "@/components/AdminLayout";
import { CoachPromoCsvImport } from "@/components/admin/CoachPromoCsvImport";
import { optionalAppBaseUrl } from "@/lib/appUrl";
import { getAdminUserOrRedirect } from "@/lib/auth";
import {
  createCoachAccessOfferAction,
  revokeCoachAccessOfferAction,
  updateCoachAccessOfferAction,
} from "@/lib/coachPromoActions";
import {
  activeDuplicateKey,
  durationLabel,
  getAdminCoachAccessOffers,
  offerStatus,
  offerTypeLabel,
} from "@/lib/coachAccessOffers";
import type { CoachAccessOffer, CoachAccessOfferStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const offerMessages: Record<string, string> = {
  created: "Coach offer created.",
  updated: "Coach offer updated.",
  extended: "Coach offer extended.",
  revoked: "Coach offer revoked.",
  "updated-subscription-warning":
    "Offer updated. This offer has an active Stripe subscription, so confirm the Stripe subscription schedule separately if duration changed.",
};

const errorMessages: Record<string, string> = {
  "invalid-offer": "Check the email, offer type, and duration before saving.",
  "duplicate-offer": "An active offer already exists for that email and offer type. Choose a duplicate handling option.",
  "save-failed": "The offer could not be saved. Check server logs for details.",
  "not-found": "That offer could not be found.",
  "missing-csv": "Add CSV text or upload a CSV file before importing.",
};

export default async function AdminCoachPromoPage({
  searchParams,
}: {
  searchParams: Promise<{
    offer?: string;
    error?: string;
    import?: string;
    created?: string;
    updated?: string;
    skipped?: string;
    invalid?: string;
  }>;
}) {
  await getAdminUserOrRedirect();
  const params = await searchParams;
  const offers = await getAdminCoachAccessOffers();
  const activeKeys = offers
    .filter((offer) => !offer.revoked_at)
    .map((offer) => activeDuplicateKey(offer.normalized_email, offer.offer_type));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Coach Promo</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-700">
            Grant free premium access or private founding-rate subscription eligibility to approved coach emails.
            These are not public promo codes.
          </p>
        </div>

        {params.offer && offerMessages[params.offer] ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {offerMessages[params.offer]}
          </p>
        ) : null}
        {params.error && errorMessages[params.error] ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessages[params.error]}
          </p>
        ) : null}
        {params.import === "done" ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Import complete: {params.created ?? 0} created, {params.updated ?? 0} updated,{" "}
            {params.skipped ?? 0} skipped, {params.invalid ?? 0} invalid.
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Create coach offer</h2>
          <form action={createCoachAccessOfferAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-800">
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="coach@example.com"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Offer type
              <select
                name="offer_type"
                defaultValue="free_premium"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="free_premium">Free premium access</option>
                <option value="founding_599">$5.99 founding subscription</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Duration
              <select
                name="duration"
                defaultValue="3"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Duplicate handling
              <select
                name="duplicate_mode"
                defaultValue="cancel"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="cancel">Cancel if duplicate exists</option>
                <option value="update_existing">Update existing offer</option>
                <option value="extend_existing">Extend existing offer</option>
                <option value="revoke_replace">Revoke and replace</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800 md:col-span-2">
              Notes
              <input
                name="notes"
                placeholder="Optional internal note"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 md:col-span-2">
              <input name="generate_invite_token" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Generate invite token
            </label>
            <div className="md:col-span-2">
              <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Create coach offer
              </button>
            </div>
          </form>
        </section>

        <CoachPromoCsvImport activeOfferKeys={activeKeys} />

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Existing offers</h2>
              <p className="mt-2 text-sm text-slate-600">
                Founding subscriptions with Stripe IDs may need schedule review if their duration changes.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {offers.length} offers
            </span>
          </div>
          {offers.length ? (
            <div className="mt-5 space-y-4">
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No coach offers yet.
            </p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function OfferRow({ offer }: { offer: CoachAccessOffer & { claimed_user_email?: string | null; claimed_coach_name?: string | null } }) {
  const status = offerStatus(offer);
  const baseUrl = optionalAppBaseUrl();
  const inviteUrl =
    offer.invite_token && baseUrl
      ? `${baseUrl}/coach/billing?invite=${offer.invite_token}`
      : offer.invite_token
        ? `/coach/billing?invite=${offer.invite_token}`
        : null;

  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-950">{offer.normalized_email}</p>
            <StatusPill status={status} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{offer.notes || "No notes"}</p>
          {inviteUrl ? (
            <p className="mt-2 break-all rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{inviteUrl}</p>
          ) : null}
          {offer.stripe_subscription_id ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Active Stripe subscription linked. Updating duration here does not silently rewrite the Stripe schedule.
            </p>
          ) : null}
        </div>
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-950">{offerTypeLabel(offer.offer_type)}</p>
          <p className="mt-1">{durationLabel(offer.duration_type)}</p>
          <p className="mt-1">
            {offer.is_lifetime ? "Lifetime" : offer.expires_at ? `Expires ${formatDate(offer.expires_at)}` : "No expiration"}
          </p>
        </div>
        <div className="text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-950">Claimed user:</span>{" "}
            {offer.claimed_user_email || "Unclaimed"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-950">Coach:</span> {offer.claimed_coach_name || "Not tied"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-950">Redeemed:</span>{" "}
            {offer.redeemed_at ? formatDate(offer.redeemed_at) : "Not redeemed"}
          </p>
        </div>
        <div className="grid gap-2">
          <form action={updateCoachAccessOfferAction} className="grid gap-2">
            <input type="hidden" name="offer_id" value={offer.id} />
            <select
              name="offer_type"
              defaultValue={offer.offer_type}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            >
              <option value="free_premium">Free access</option>
              <option value="founding_599">$5.99 offer</option>
            </select>
            <select
              name="duration"
              defaultValue={durationValue(offer.duration_type)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <input
              name="notes"
              defaultValue={offer.notes ?? ""}
              placeholder="Notes"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                name="update_mode"
                value="set"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
              >
                Update
              </button>
              <button
                name="update_mode"
                value="extend"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
              >
                Extend
              </button>
            </div>
          </form>
          {!offer.revoked_at ? (
            <form action={revokeCoachAccessOfferAction}>
              <input type="hidden" name="offer_id" value={offer.id} />
              <button className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:border-red-300">
                Revoke
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: CoachAccessOfferStatus }) {
  const colors: Record<CoachAccessOfferStatus, string> = {
    unclaimed: "bg-slate-100 text-slate-700",
    claimed: "bg-sky-50 text-sky-700",
    active: "bg-emerald-50 text-emerald-700",
    expired: "bg-amber-50 text-amber-800",
    revoked: "bg-red-50 text-red-700",
    redeemed: "bg-[#f7f8f3] text-[#2f6f5e]",
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[status]}`}>{status}</span>;
}

function durationValue(durationType: CoachAccessOffer["duration_type"]) {
  switch (durationType) {
    case "three_months":
      return "3";
    case "six_months":
      return "6";
    case "twelve_months":
      return "12";
    case "lifetime":
      return "lifetime";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
