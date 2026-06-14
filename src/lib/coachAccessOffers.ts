import crypto from "node:crypto";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "./supabase";
import type {
  Coach,
  CoachAccessOffer,
  CoachAccessOfferStatus,
  CoachAccessOfferWithClaim,
  CoachOfferDurationType,
  CoachOfferType,
  Subscription,
} from "./types";

export type CoachOfferDurationInput = "3" | "6" | "12" | "lifetime";

export const coachOfferTypes: CoachOfferType[] = ["free_premium", "founding_599"];
export const coachOfferDurations: CoachOfferDurationInput[] = ["3", "6", "12", "lifetime"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOfferEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isValidOfferEmail(email: string | null | undefined) {
  return emailPattern.test(normalizeOfferEmail(email));
}

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function durationInputToType(duration: string): CoachOfferDurationType | null {
  switch (duration) {
    case "3":
    case "three_months":
      return "three_months";
    case "6":
    case "six_months":
      return "six_months";
    case "12":
    case "twelve_months":
      return "twelve_months";
    case "lifetime":
      return "lifetime";
    default:
      return null;
  }
}

export function durationTypeToMonths(durationType: CoachOfferDurationType) {
  switch (durationType) {
    case "three_months":
      return 3;
    case "six_months":
      return 6;
    case "twelve_months":
      return 12;
    case "lifetime":
      return null;
  }
}

export function durationLabel(durationType: CoachOfferDurationType) {
  switch (durationType) {
    case "three_months":
      return "3 months";
    case "six_months":
      return "6 months";
    case "twelve_months":
      return "12 months";
    case "lifetime":
      return "Lifetime";
  }
}

export function offerTypeLabel(offerType: CoachOfferType) {
  return offerType === "free_premium" ? "Free premium access" : "$5.99 founding subscription";
}

export function planCodeForOfferType(offerType: CoachOfferType) {
  return offerType === "free_premium" ? "premium" : "founding_599";
}

export function offerWindowForDuration(durationType: CoachOfferDurationType, startDate = new Date()): OfferWindow {
  const durationMonths = durationTypeToMonths(durationType);
  if (!durationMonths) {
    return {
      starts_at: startDate.toISOString(),
      expires_at: null,
      duration_months: null,
      is_lifetime: true,
    };
  }

  const expiresAt = new Date(startDate);
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  return {
    starts_at: startDate.toISOString(),
    expires_at: expiresAt.toISOString(),
    duration_months: durationMonths,
    is_lifetime: false,
  };
}

export function extendOfferWindow(offer: CoachAccessOffer, durationType: CoachOfferDurationType): OfferWindow {
  if (durationType === "lifetime") {
    return offerWindowForDuration("lifetime", new Date(offer.starts_at));
  }

  const currentEnd = offer.expires_at ? new Date(offer.expires_at) : new Date();
  const base = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
  const durationMonths = durationTypeToMonths(durationType) ?? 0;
  const expiresAt = new Date(base);
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  return {
    starts_at: offer.starts_at,
    expires_at: expiresAt.toISOString(),
    duration_months: durationMonths,
    is_lifetime: false,
  };
}

type OfferWindow = {
  starts_at: string;
  expires_at: string | null;
  duration_months: number | null;
  is_lifetime: boolean;
};

export function offerStatus(offer: CoachAccessOffer): CoachAccessOfferStatus {
  if (offer.revoked_at) {
    return "revoked";
  }

  if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
    return "expired";
  }

  if (offer.stripe_subscription_id) {
    return "active";
  }

  if (offer.redeemed_at || offer.redeemed_count > 0) {
    return "redeemed";
  }

  if (offer.user_id || offer.coach_id) {
    return "claimed";
  }

  return "unclaimed";
}

export function isOfferUsableByUser(offer: CoachAccessOffer, userId: string) {
  if (offer.revoked_at) {
    return false;
  }

  if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
    return false;
  }

  if (offer.user_id && offer.user_id !== userId) {
    return false;
  }

  return offer.redeemed_count < offer.max_redemptions || offer.user_id === userId;
}

export async function getEligibleCoachOfferForUser({
  email,
  userId,
  offerType,
  inviteToken,
}: {
  email: string | null | undefined;
  userId: string;
  offerType?: CoachOfferType;
  inviteToken?: string | null;
}) {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return null;
  }

  const normalizedEmail = normalizeOfferEmail(email);
  if (!isValidOfferEmail(normalizedEmail)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("coach_access_offers")
    .select("*")
    .eq("normalized_email", normalizedEmail)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false });

  if (offerType) {
    query = query.eq("offer_type", offerType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[coach offers] eligibility lookup failed", {
      userId,
      message: error.message,
      code: error.code,
    });
    return null;
  }

  const offers = ((data ?? []) as CoachAccessOffer[]).filter((offer) => isOfferUsableByUser(offer, userId));
  if (!offers.length) {
    return null;
  }

  const cleanInviteToken = inviteToken?.trim();
  if (cleanInviteToken) {
    const invited = offers.find((offer) => offer.invite_token === cleanInviteToken);
    if (invited) {
      return invited;
    }
  }

  return offers[0] ?? null;
}

export async function getCoachBillingOfferState({
  userId,
  email,
  coach,
  inviteToken,
}: {
  userId: string;
  email: string | null | undefined;
  coach: Coach;
  inviteToken?: string | null;
}) {
  const [freeOffer, foundingOffer, subscription] = await Promise.all([
    getEligibleCoachOfferForUser({ userId, email, offerType: "free_premium", inviteToken }),
    getEligibleCoachOfferForUser({ userId, email, offerType: "founding_599", inviteToken }),
    getLatestCoachSubscription(userId),
  ]);

  return {
    freeOffer,
    foundingOffer,
    subscription,
    normalizedEmail: normalizeOfferEmail(email),
    coach,
  };
}

export async function getLatestCoachSubscription(coachUserId: string) {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("coach_user_id", coachUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Subscription>();

  if (error) {
    console.error("[coach subscriptions] latest lookup failed", {
      coachUserId,
      message: error.message,
      code: error.code,
    });
    return null;
  }

  return data;
}

export async function applyFreePremiumOfferForCoach({
  offer,
  userId,
  coachId,
  grantedBy,
}: {
  offer: CoachAccessOffer;
  userId: string;
  coachId: string;
  grantedBy?: string | null;
}) {
  if (offer.offer_type !== "free_premium" || !isOfferUsableByUser(offer, userId)) {
    return { ok: false as const, reason: "not-eligible" as const };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const grantPayload = {
    coach_id: coachId,
    user_id: userId,
    coach_user_id: userId,
    grant_type: "coach_offer_free",
    starts_at: now,
    ends_at: offer.expires_at,
    granted_by: grantedBy ?? offer.created_by ?? null,
    is_active: true,
    notes: offer.notes ? `Coach promo offer: ${offer.notes}` : "Coach promo offer",
    coach_access_offer_id: offer.id,
    updated_at: now,
  };

  const { data: existingGrant } = await supabase
    .from("premium_access_grants")
    .select("id")
    .eq("coach_access_offer_id", offer.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  const grantResult = existingGrant?.id
    ? await supabase.from("premium_access_grants").update(grantPayload).eq("id", existingGrant.id)
    : await supabase.from("premium_access_grants").insert({ ...grantPayload, created_at: now });

  if (grantResult.error) {
    console.error("[coach offers] free premium grant failed", {
      offerId: offer.id,
      userId,
      coachId,
      message: grantResult.error.message,
      code: grantResult.error.code,
    });
    return { ok: false as const, reason: "grant-failed" as const };
  }

  const firstRedemptionForUser = !offer.redeemed_at || offer.user_id !== userId;
  const { error: offerError } = await supabase
    .from("coach_access_offers")
    .update({
      user_id: userId,
      coach_id: coachId,
      redeemed_count: firstRedemptionForUser
        ? Math.min(offer.max_redemptions, offer.redeemed_count + 1)
        : offer.redeemed_count,
      redeemed_at: offer.redeemed_at ?? now,
      updated_at: now,
    })
    .eq("id", offer.id);

  if (offerError) {
    console.error("[coach offers] free premium offer redemption update failed", {
      offerId: offer.id,
      userId,
      coachId,
      message: offerError.message,
      code: offerError.code,
    });
    return { ok: false as const, reason: "offer-update-failed" as const };
  }

  return { ok: true as const };
}

export async function applyEligibleFreeCoachOfferForUser({
  userId,
  email,
  coachId,
  inviteToken,
}: {
  userId: string;
  email: string | null | undefined;
  coachId: string;
  inviteToken?: string | null;
}) {
  const offer = await getEligibleCoachOfferForUser({
    userId,
    email,
    offerType: "free_premium",
    inviteToken,
  });

  if (!offer) {
    return { ok: false as const, reason: "no-offer" as const };
  }

  return applyFreePremiumOfferForCoach({ offer, userId, coachId });
}

export async function getAdminCoachAccessOffers(): Promise<CoachAccessOfferWithClaim[]> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coach_access_offers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[coach offers] admin offer list failed", {
      message: error.message,
      code: error.code,
    });
    return [];
  }

  const offers = (data ?? []) as CoachAccessOffer[];
  const userIds = [...new Set(offers.map((offer) => offer.user_id).filter((id): id is string => Boolean(id)))];
  const coachIds = [...new Set(offers.map((offer) => offer.coach_id).filter((id): id is string => Boolean(id)))];
  const userEmailById = new Map<string, string | null>();
  const coachNameById = new Map<string, string | null>();

  if (userIds.length) {
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!usersError) {
      for (const user of users.users) {
        if (userIds.includes(user.id)) {
          userEmailById.set(user.id, user.email ?? null);
        }
      }
    }
  }

  if (coachIds.length) {
    const { data: coaches } = await supabase.from("coaches").select("id, full_name").in("id", coachIds);
    for (const coach of (coaches ?? []) as Pick<Coach, "id" | "full_name">[]) {
      coachNameById.set(coach.id, coach.full_name);
    }
  }

  return offers.map((offer) => ({
    ...offer,
    claimed_user_email: offer.user_id ? (userEmailById.get(offer.user_id) ?? offer.user_id) : null,
    claimed_coach_name: offer.coach_id ? (coachNameById.get(offer.coach_id) ?? offer.coach_id) : null,
  }));
}

export function activeDuplicateKey(email: string, offerType: CoachOfferType) {
  return `${normalizeOfferEmail(email)}::${offerType}`;
}
