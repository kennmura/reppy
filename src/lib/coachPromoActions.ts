"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUserOrRedirect, getCoachContextOrRedirect } from "./auth";
import {
  applyFreePremiumOfferForCoach,
  durationInputToType,
  extendOfferWindow,
  generateInviteToken,
  getEligibleCoachOfferForUser,
  isValidOfferEmail,
  normalizeOfferEmail,
  offerWindowForDuration,
  planCodeForOfferType,
} from "./coachAccessOffers";
import {
  createStripeBillingPortalSession,
  createStripeConnectExpressAccount,
  createStripeConnectOnboardingLink,
  createStripeSubscriptionCheckoutSession,
  hasStripeCoachSubscriptionConfig,
  hasStripeCheckoutConfig,
  stripeCoachPriceIdForPlan,
  type CoachSubscriptionPlanCode,
} from "./payments";
import { createSupabaseAdminClient } from "./supabase";
import type { CoachAccessOffer, CoachOfferDurationType, CoachOfferType } from "./types";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fileValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function parseOfferType(value: string): CoachOfferType | null {
  return value === "free_premium" || value === "founding_599" ? value : null;
}

function parsePlanCode(value: string): CoachSubscriptionPlanCode | null {
  return value === "premium_monthly" || value === "premium_annual" || value === "founding_599" ? value : null;
}

function queryString(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const text = searchParams.toString();
  return text ? `?${text}` : "";
}

function activeOfferQuery(email: string, offerType: CoachOfferType) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  return supabase
    .from("coach_access_offers")
    .select("*")
    .eq("normalized_email", email)
    .eq("offer_type", offerType)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CoachAccessOffer>();
}

function buildOfferPayload({
  email,
  offerType,
  durationType,
  notes,
  source,
  inviteToken,
  adminUserId,
  startDate,
}: {
  email: string;
  offerType: CoachOfferType;
  durationType: CoachOfferDurationType;
  notes: string | null;
  source: CoachAccessOffer["source"];
  inviteToken: string | null;
  adminUserId: string;
  startDate?: Date;
}) {
  return {
    normalized_email: email,
    offer_type: offerType,
    plan_code: planCodeForOfferType(offerType),
    duration_type: durationType,
    ...offerWindowForDuration(durationType, startDate ?? new Date()),
    max_redemptions: 1,
    source,
    invite_token: inviteToken,
    notes,
    created_by: adminUserId,
    updated_by: adminUserId,
  };
}

export async function createCoachAccessOfferAction(formData: FormData) {
  const adminUser = await getAdminUserOrRedirect();
  const email = normalizeOfferEmail(textValue(formData, "email"));
  const offerType = parseOfferType(textValue(formData, "offer_type"));
  const durationType = durationInputToType(textValue(formData, "duration"));
  const notes = textValue(formData, "notes") || null;
  const duplicateMode = textValue(formData, "duplicate_mode") || "cancel";
  const shouldGenerateInvite = formData.get("generate_invite_token") === "on";

  if (!isValidOfferEmail(email) || !offerType || !durationType) {
    redirect("/admin/coach-promo?error=invalid-offer");
  }

  const supabase = createSupabaseAdminClient();
  const { data: duplicate, error: duplicateError } = await activeOfferQuery(email, offerType);
  if (duplicateError) {
    console.error("[coach promo] duplicate lookup failed", {
      email,
      offerType,
      message: duplicateError.message,
      code: duplicateError.code,
    });
    redirect("/admin/coach-promo?error=save-failed");
  }

  if (duplicate) {
    if (duplicateMode === "cancel") {
      redirect("/admin/coach-promo?error=duplicate-offer");
    }

    if (duplicateMode === "update_existing" || duplicateMode === "extend_existing") {
      const window =
        duplicateMode === "extend_existing"
          ? extendOfferWindow(duplicate, durationType)
          : offerWindowForDuration(durationType, new Date(duplicate.starts_at));
      const { error } = await supabase
        .from("coach_access_offers")
        .update({
          duration_type: durationType,
          ...window,
          notes,
          updated_by: adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", duplicate.id);

      if (error) {
        console.error("[coach promo] duplicate update failed", {
          offerId: duplicate.id,
          message: error.message,
          code: error.code,
        });
        redirect("/admin/coach-promo?error=save-failed");
      }

      revalidatePath("/admin/coach-promo");
      redirect(`/admin/coach-promo?offer=${duplicateMode === "extend_existing" ? "extended" : "updated"}`);
    }

    if (duplicateMode === "revoke_replace") {
      const { error } = await supabase
        .from("coach_access_offers")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: adminUser.id,
          updated_by: adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", duplicate.id);

      if (error) {
        console.error("[coach promo] duplicate revoke failed", {
          offerId: duplicate.id,
          message: error.message,
          code: error.code,
        });
        redirect("/admin/coach-promo?error=save-failed");
      }
    }
  }

  const inviteToken = shouldGenerateInvite ? generateInviteToken() : null;
  const { error } = await supabase.from("coach_access_offers").insert(
    buildOfferPayload({
      email,
      offerType,
      durationType,
      notes,
      source: "admin",
      inviteToken,
      adminUserId: adminUser.id,
    }),
  );

  if (error) {
    console.error("[coach promo] offer create failed", {
      email,
      offerType,
      message: error.message,
      code: error.code,
    });
    redirect("/admin/coach-promo?error=save-failed");
  }

  revalidatePath("/admin/coach-promo");
  redirect("/admin/coach-promo?offer=created");
}

export async function updateCoachAccessOfferAction(formData: FormData) {
  const adminUser = await getAdminUserOrRedirect();
  const offerId = textValue(formData, "offer_id");
  const offerType = parseOfferType(textValue(formData, "offer_type"));
  const durationType = durationInputToType(textValue(formData, "duration"));
  const updateMode = textValue(formData, "update_mode") === "extend" ? "extend" : "set";
  const notes = textValue(formData, "notes") || null;

  if (!offerId || !offerType || !durationType) {
    redirect("/admin/coach-promo?error=invalid-offer");
  }

  const supabase = createSupabaseAdminClient();
  const { data: offer, error: offerError } = await supabase
    .from("coach_access_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle<CoachAccessOffer>();

  if (offerError || !offer) {
    if (offerError) {
      console.error("[coach promo] offer read for update failed", {
        offerId,
        message: offerError.message,
        code: offerError.code,
      });
    }
    redirect("/admin/coach-promo?error=not-found");
  }

  const window = updateMode === "extend" ? extendOfferWindow(offer, durationType) : offerWindowForDuration(durationType, new Date(offer.starts_at));
  const { error } = await supabase
    .from("coach_access_offers")
    .update({
      offer_type: offerType,
      plan_code: planCodeForOfferType(offerType),
      duration_type: durationType,
      ...window,
      notes,
      updated_by: adminUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId);

  if (error) {
    console.error("[coach promo] offer update failed", {
      offerId,
      message: error.message,
      code: error.code,
    });
    redirect("/admin/coach-promo?error=save-failed");
  }

  revalidatePath("/admin/coach-promo");
  redirect(`/admin/coach-promo?offer=${offer.stripe_subscription_id ? "updated-subscription-warning" : "updated"}`);
}

export async function revokeCoachAccessOfferAction(formData: FormData) {
  const adminUser = await getAdminUserOrRedirect();
  const offerId = textValue(formData, "offer_id");

  if (!offerId) {
    redirect("/admin/coach-promo?error=not-found");
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("coach_access_offers")
    .update({
      revoked_at: now,
      revoked_by: adminUser.id,
      updated_by: adminUser.id,
      updated_at: now,
    })
    .eq("id", offerId);

  if (error) {
    console.error("[coach promo] offer revoke failed", {
      offerId,
      message: error.message,
      code: error.code,
    });
    redirect("/admin/coach-promo?error=save-failed");
  }

  const { error: grantError } = await supabase
    .from("premium_access_grants")
    .update({ is_active: false, updated_at: now })
    .eq("coach_access_offer_id", offerId);

  if (grantError) {
    console.error("[coach promo] linked grant revoke failed", {
      offerId,
      message: grantError.message,
      code: grantError.code,
    });
  }

  revalidatePath("/admin/coach-promo");
  revalidatePath("/admin/subscriptions");
  redirect("/admin/coach-promo?offer=revoked");
}

export async function importCoachAccessOffersAction(formData: FormData) {
  const adminUser = await getAdminUserOrRedirect();
  const defaultOfferType = parseOfferType(textValue(formData, "default_offer_type")) ?? "free_premium";
  const defaultDurationType = durationInputToType(textValue(formData, "default_duration")) ?? "three_months";
  const pastedCsv = textValue(formData, "csv_text");
  const uploaded = fileValue(formData, "csv_file");
  const uploadedText = uploaded ? await uploaded.text() : "";
  const csvText = [pastedCsv, uploadedText].filter(Boolean).join("\n");

  if (!csvText.trim()) {
    redirect("/admin/coach-promo?error=missing-csv");
  }

  const rows = parseCsv(csvText);
  const supabase = createSupabaseAdminClient();
  const seenKeys = new Set<string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const row of rows) {
    const email = normalizeOfferEmail(row.email);
    const offerType = parseOfferType(row.offer_type || "") ?? defaultOfferType;
    const durationType = durationInputToType(row.duration || "") ?? defaultDurationType;
    const notes = row.notes?.trim() || null;
    const rawInviteToken = row.invite_token?.trim() || null;
    const inviteToken = rawInviteToken || null;

    if (!isValidOfferEmail(email) || !offerType || !durationType) {
      invalid += 1;
      continue;
    }

    const key = `${email}::${offerType}`;
    if (seenKeys.has(key)) {
      skipped += 1;
      continue;
    }
    seenKeys.add(key);

    const { data: existing, error: lookupError } = await activeOfferQuery(email, offerType);
    if (lookupError) {
      console.error("[coach promo] import duplicate lookup failed", {
        email,
        offerType,
        message: lookupError.message,
        code: lookupError.code,
      });
      skipped += 1;
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from("coach_access_offers")
        .update({
          duration_type: durationType,
          ...offerWindowForDuration(durationType, new Date(existing.starts_at)),
          notes,
          invite_token: inviteToken ?? existing.invite_token,
          source: "csv_upload",
          updated_by: adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        console.error("[coach promo] import update failed", {
          offerId: existing.id,
          message: error.message,
          code: error.code,
        });
        skipped += 1;
      } else {
        updated += 1;
      }
      continue;
    }

    const { error } = await supabase.from("coach_access_offers").insert(
      buildOfferPayload({
        email,
        offerType,
        durationType,
        notes,
        source: "csv_upload",
        inviteToken,
        adminUserId: adminUser.id,
      }),
    );

    if (error) {
      console.error("[coach promo] import create failed", {
        email,
        offerType,
        message: error.message,
        code: error.code,
      });
      skipped += 1;
    } else {
      created += 1;
    }
  }

  revalidatePath("/admin/coach-promo");
  redirect(
    `/admin/coach-promo${queryString({
      import: "done",
      created,
      updated,
      skipped,
      invalid,
    })}`,
  );
}

export async function redeemFreeCoachOfferAction(formData: FormData) {
  const { user, coach } = await getCoachContextOrRedirect();
  const inviteToken = textValue(formData, "invite_token") || null;
  const offer = await getEligibleCoachOfferForUser({
    userId: user.id,
    email: user.email,
    offerType: "free_premium",
    inviteToken,
  });

  if (!offer) {
    redirect("/coach/billing?billing_error=free-offer-unavailable");
  }

  const result = await applyFreePremiumOfferForCoach({
    offer,
    userId: user.id,
    coachId: coach.id,
  });

  if (!result.ok) {
    redirect(`/coach/billing?billing_error=${result.reason}`);
  }

  revalidatePath("/coach/billing");
  revalidatePath("/coach/messages");
  redirect("/coach/billing?billing=free-applied");
}

export async function startCoachSubscriptionCheckoutAction(formData: FormData) {
  const { user, coach } = await getCoachContextOrRedirect();
  const planCode = parsePlanCode(textValue(formData, "plan_code"));
  const inviteToken = textValue(formData, "invite_token") || null;

  if (!planCode) {
    redirect("/coach/billing?billing_error=invalid-plan");
  }

  let offer: CoachAccessOffer | null = null;
  if (planCode === "founding_599") {
    offer = await getEligibleCoachOfferForUser({
      userId: user.id,
      email: user.email,
      offerType: "founding_599",
      inviteToken,
    });

    if (!offer) {
      redirect("/coach/billing?billing_error=founding-not-eligible");
    }
  }

  if (!hasStripeCoachSubscriptionConfig(planCode)) {
    redirect("/coach/billing?billing_error=missing-stripe-config");
  }

  const priceId = stripeCoachPriceIdForPlan(planCode);
  const supabase = createSupabaseAdminClient();
  if (offer) {
    const { error } = await supabase
      .from("coach_access_offers")
      .update({
        user_id: user.id,
        coach_id: coach.id,
        stripe_price_id: priceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id)
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    if (error) {
      console.error("[coach promo] founding offer claim failed", {
        offerId: offer.id,
        userId: user.id,
        message: error.message,
        code: error.code,
      });
      redirect("/coach/billing?billing_error=founding-claim-failed");
    }
  }

  let checkoutUrl = "";
  try {
    const session = await createStripeSubscriptionCheckoutSession({
      coachUserId: user.id,
      coachId: coach.id,
      coachName: coach.full_name,
      coachEmail: user.email ?? null,
      planCode,
      offerId: offer?.id ?? null,
      offerDurationMonths: offer?.duration_months ?? null,
      offerDurationType: offer?.duration_type ?? null,
    });

    checkoutUrl = session.url;

    if (offer) {
      await supabase
        .from("coach_access_offers")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", offer.id);
    }
  } catch (error) {
    console.error("[coach subscription] checkout creation failed", {
      coachUserId: user.id,
      coachId: coach.id,
      planCode,
      message: error instanceof Error ? error.message : String(error),
    });
    redirect("/coach/billing?billing_error=checkout-failed");
  }

  redirect(checkoutUrl);
}

export async function startCoachBillingPortalAction() {
  const { user } = await getCoachContextOrRedirect();

  if (!hasStripeCheckoutConfig()) {
    redirect("/coach/billing?billing_error=missing-stripe-config");
  }

  const supabase = createSupabaseAdminClient();
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("coach_user_id", user.id)
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_customer_id: string | null }>();

  if (error) {
    console.error("[coach billing] subscription customer lookup failed", {
      coachUserId: user.id,
      message: error.message,
      code: error.code,
    });
    redirect("/coach/billing?billing_error=portal-failed");
  }

  if (!subscription?.provider_customer_id) {
    redirect("/coach/billing?billing_error=missing-customer");
  }

  let portalUrl = "";
  try {
    const session = await createStripeBillingPortalSession({
      customerId: subscription.provider_customer_id,
      returnPath: "/coach/billing?billing=portal-return",
    });
    portalUrl = session.url;
  } catch (error) {
    console.error("[coach billing] portal creation failed", {
      coachUserId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
    redirect("/coach/billing?billing_error=portal-failed");
  }

  redirect(portalUrl);
}

export async function startCoachPayoutOnboardingAction() {
  const { user, coach } = await getCoachContextOrRedirect();

  if (!hasStripeCheckoutConfig()) {
    redirect("/coach/billing?billing_error=missing-stripe-config");
  }

  const supabase = createSupabaseAdminClient();
  let accountId = coach.stripe_connected_account_id ?? "";

  if (!accountId) {
    try {
      const account = await createStripeConnectExpressAccount({
        coachUserId: user.id,
        coachId: coach.id,
        email: user.email ?? coach.email,
      });
      accountId = account.id;
    } catch (error) {
      console.error("[coach payouts] Connect account creation failed", {
        coachUserId: user.id,
        coachId: coach.id,
        message: error instanceof Error ? error.message : String(error),
      });
      redirect("/coach/billing?billing_error=connect-failed");
    }

    const { error } = await supabase
      .from("coaches")
      .update({ stripe_connected_account_id: accountId, updated_at: new Date().toISOString() })
      .eq("id", coach.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[coach payouts] Connect account save failed", {
        coachUserId: user.id,
        coachId: coach.id,
        message: error.message,
        code: error.code,
      });
      redirect("/coach/billing?billing_error=connect-save-failed");
    }
  }

  let onboardingUrl = "";
  try {
    const link = await createStripeConnectOnboardingLink({ accountId });
    onboardingUrl = link.url;
  } catch (error) {
    console.error("[coach payouts] Connect onboarding link creation failed", {
      coachUserId: user.id,
      coachId: coach.id,
      message: error instanceof Error ? error.message : String(error),
    });
    redirect("/coach/billing?billing_error=connect-failed");
  }

  redirect(onboardingUrl);
}

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const first = splitCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const hasHeader = first.includes("email");
  const headers = hasHeader ? first : ["email", "offer_type", "duration", "notes", "invite_token"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index]?.trim() ?? "";
      return row;
    }, {});
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}
