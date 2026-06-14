import { createSupabaseAdminClient } from "./supabase";
import type { Coach, MessageAccess, SubscriptionStatus } from "./types";

const activeSubscriptionStatuses: SubscriptionStatus[] = ["active", "trialing", "canceling"];

function isFuture(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

export function emptyMessageAccess(): MessageAccess {
  return {
    hasAccess: false,
    reason: "none",
    status: "free",
    trialEndsAt: null,
    accessEndsAt: null,
    foundingPriceLocked: false,
  };
}

export async function getMessageAccess({
  coach,
  coachUserId,
}: {
  coach: Coach;
  coachUserId: string | null;
}): Promise<MessageAccess> {
  const supabase = createSupabaseAdminClient();

  if (isFuture(coach.admin_premium_access_until)) {
    return {
      hasAccess: true,
      reason: "admin",
      status: "active",
      trialEndsAt: null,
      accessEndsAt: coach.admin_premium_access_until ?? null,
      foundingPriceLocked: Boolean(coach.founding_price_locked),
    };
  }

  if (!coachUserId) {
    return emptyMessageAccess();
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("coach_user_id", coachUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      status: SubscriptionStatus;
      current_period_end: string | null;
      trial_ends_at: string | null;
      access_ends_at: string | null;
      founding_price_locked: boolean | null;
    }>();

  if (subscription) {
    const hasPaidAccess =
      activeSubscriptionStatuses.includes(subscription.status) &&
      (isFuture(subscription.current_period_end) || isFuture(subscription.access_ends_at));
    const hasTrialAccess = subscription.status === "trialing" && isFuture(subscription.trial_ends_at);

    if (hasPaidAccess || hasTrialAccess) {
      return {
        hasAccess: true,
        reason: hasTrialAccess ? "trial" : "subscription",
        status: subscription.status,
        trialEndsAt: subscription.trial_ends_at,
        accessEndsAt: subscription.access_ends_at ?? subscription.current_period_end,
        foundingPriceLocked: Boolean(subscription.founding_price_locked),
      };
    }
  }

  const { data: grant } = await supabase
    .from("premium_access_grants")
    .select("ends_at, grant_type")
    .eq("coach_user_id", coachUserId)
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ ends_at: string; grant_type: string }>();

  if (grant) {
    return {
      hasAccess: true,
      reason: grant.grant_type === "trial" ? "trial" : "grant",
      status: "active",
      trialEndsAt: grant.grant_type === "trial" ? grant.ends_at : null,
      accessEndsAt: grant.ends_at,
      foundingPriceLocked: Boolean(coach.founding_price_locked),
    };
  }

  return {
    ...emptyMessageAccess(),
    status: subscription?.status ?? "free",
    trialEndsAt: subscription?.trial_ends_at ?? null,
    accessEndsAt: subscription?.access_ends_at ?? subscription?.current_period_end ?? null,
    foundingPriceLocked: Boolean(subscription?.founding_price_locked ?? coach.founding_price_locked),
  };
}

export async function startCoachTrial({
  coachUserId,
  foundingPriceLocked,
}: {
  coachUserId: string;
  foundingPriceLocked: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, trial_started_at")
    .eq("coach_user_id", coachUserId)
    .not("trial_started_at", "is", null)
    .limit(1)
    .maybeSingle<{ id: string; trial_started_at: string | null }>();

  if (existing?.trial_started_at) {
    return { ok: false, reason: "trial-used" as const };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { error } = await supabase.from("subscriptions").insert({
    coach_user_id: coachUserId,
    plan_code: "founding_premium_500",
    status: "trialing",
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    access_ends_at: trialEndsAt.toISOString(),
    founding_price_locked: foundingPriceLocked,
  });

  if (error) {
    throw error;
  }

  return { ok: true, trialEndsAt: trialEndsAt.toISOString() };
}

export function formatAccessBanner(access: MessageAccess) {
  if (access.reason !== "trial" || !access.trialEndsAt) {
    return null;
  }

  const msRemaining = new Date(access.trialEndsAt).getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return {
    title: "Premium trial active",
    body: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`,
    warning:
      daysRemaining <= 2
        ? "Your Message Center will lock when your trial ends. Upgrade to keep access to conversations and player records."
        : null,
  };
}
