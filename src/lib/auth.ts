import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "./supabase";
import { isPhoneVerificationBypassed } from "./accountConfig";
import { applyEligibleFreeCoachOfferForUser } from "./coachAccessOffers";
import type { AccountPrivateDetails, Coach, UserProfile, UserRole } from "./types";

const allRoles: UserRole[] = ["coach", "parent", "adult_player", "admin"];

function isActive(profile: UserProfile | null) {
  return profile?.account_status === "active";
}

export function isPlayerAccountRole(role: string | null | undefined): role is "parent" | "adult_player" {
  return role === "parent" || role === "adult_player";
}

export function roleFromUserMetadata(user: User, fallback: UserRole = "parent") {
  const metadataRole = user.user_metadata?.role;
  return typeof metadataRole === "string" && allRoles.includes(metadataRole as UserRole)
    ? (metadataRole as UserRole)
    : fallback;
}

function displayNameFromUser(user: User, fallback = "Player/Parent user") {
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email ?? fallback;
}

function bypassVerifiedAt() {
  return isPhoneVerificationBypassed() ? new Date().toISOString() : null;
}

async function syncVerifiedEmail(userId: string, emailVerifiedAt: string | null | undefined) {
  if (!emailVerifiedAt) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("user_profiles")
    .update({ email_verified_at: emailVerifiedAt, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .is("email_verified_at", null);
}

export async function getApplicationProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAccountPrivateDetails(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("account_private_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<AccountPrivateDetails>();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureApplicationProfile({
  userId,
  role,
  displayName,
  emailVerifiedAt,
  phoneVerifiedAt,
}: {
  userId: string;
  role: UserRole;
  displayName: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const existing = await getApplicationProfile(userId);
  const resolvedPhoneVerifiedAt =
    existing?.phone_verified_at ?? phoneVerifiedAt ?? (isPlayerAccountRole(role) ? bypassVerifiedAt() : null);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: userId,
        role,
        display_name: displayName || "Reppy user",
        account_status: "active",
        email_verified_at: existing?.email_verified_at ?? emailVerifiedAt ?? null,
        phone_verified_at: resolvedPhoneVerifiedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single<UserProfile>();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureAccountPrivateDetails({
  userId,
  accountType,
  phoneE164,
  phoneVerifiedAt,
  playerDateOfBirth,
}: {
  userId: string;
  accountType: "parent" | "adult_player";
  phoneE164?: string | null;
  phoneVerifiedAt?: string | null;
  playerDateOfBirth?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const existing = await getAccountPrivateDetails(userId);
  const now = new Date().toISOString();
  const resolvedPhoneVerifiedAt = existing?.phone_verified_at ?? phoneVerifiedAt ?? bypassVerifiedAt();
  const resolvedPhone =
    phoneE164 === undefined ? (existing?.phone_e164 ?? null) : (phoneE164 || existing?.phone_e164 || null);
  const resolvedPlayerDateOfBirth =
    playerDateOfBirth === undefined
      ? (existing?.player_date_of_birth ?? null)
      : (playerDateOfBirth || existing?.player_date_of_birth || null);
  const privateDetailsPayload = {
    user_id: userId,
    phone_e164: resolvedPhone,
    phone_verified_at: resolvedPhoneVerifiedAt,
    player_date_of_birth: resolvedPlayerDateOfBirth,
    account_type: accountType,
    updated_at: now,
  };
  let { data, error } = await supabase
    .from("account_private_details")
    .upsert(
      privateDetailsPayload,
      { onConflict: "user_id" },
    )
    .select("*")
    .single<AccountPrivateDetails>();

  if (error && /player_date_of_birth|schema cache|column/i.test(error.message)) {
    const legacyPayload: Record<string, string | null> = { ...privateDetailsPayload };
    delete legacyPayload.player_date_of_birth;
    const fallback = await supabase
      .from("account_private_details")
      .upsert(legacyPayload, { onConflict: "user_id" })
      .select("*")
      .single<AccountPrivateDetails>();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function repairAccountForAuthUser(user: User) {
  const existingProfile = await getApplicationProfile(user.id);
  const fallbackRole = roleFromUserMetadata(user);
  let profile = existingProfile;

  if (!profile) {
    profile = await ensureApplicationProfile({
      userId: user.id,
      role: fallbackRole,
      displayName: displayNameFromUser(user),
      emailVerifiedAt: user.email_confirmed_at ?? null,
      phoneVerifiedAt: user.phone_confirmed_at ?? null,
    });
  } else {
    if (user.email_confirmed_at && !profile.email_verified_at) {
      await syncVerifiedEmail(user.id, user.email_confirmed_at);
      profile.email_verified_at = user.email_confirmed_at;
    }

    if (isPlayerAccountRole(profile.role) && isPhoneVerificationBypassed() && !profile.phone_verified_at) {
      const now = new Date().toISOString();
      const supabase = createSupabaseAdminClient();
      await supabase
        .from("user_profiles")
        .update({ phone_verified_at: now, updated_at: now })
        .eq("id", user.id)
        .is("phone_verified_at", null);
      profile.phone_verified_at = now;
    }
  }

  if (!isPlayerAccountRole(profile.role)) {
    return { profile, privateDetails: null };
  }

  const privateDetails = await ensureAccountPrivateDetails({
    userId: user.id,
    accountType: profile.role,
    phoneE164: user.phone ?? undefined,
    phoneVerifiedAt: user.phone_confirmed_at ?? null,
  });

  return { profile, privateDetails };
}

export async function getAdminUserOrRedirect() {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    redirect("/admin/login?error=missing-admin-email");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || data.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/admin/login");
  }

  return data.user;
}

export async function getCoachUserOrRedirect() {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    redirect("/account/login?error=missing-supabase");
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data } = await supabaseAuth.auth.getUser();

  if (!data.user) {
    redirect("/account/login");
  }

  const profile = await getApplicationProfile(data.user.id);

  if (!profile) {
    redirect("/account/login?error=no-profile");
  }

  if (profile.role !== "coach" || !isActive(profile)) {
    redirect("/account/login?error=wrong-role");
  }

  if (!data.user.email_confirmed_at) {
    redirect("/account/login?error=verify-email");
  }

  await syncVerifiedEmail(data.user.id, data.user.email_confirmed_at);

  return {
    user: data.user,
    profile,
  };
}

export async function getCoachContextOrRedirect() {
  const { user, profile } = await getCoachUserOrRedirect();
  const supabase = createSupabaseAdminClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("*")
    .or(`user_id.eq.${user.id},email.eq.${user.email ?? ""}`)
    .limit(1)
    .maybeSingle<Coach>();

  if (!coach) {
    redirect("/coach/onboarding");
  }

  if (!coach.user_id) {
    await supabase.from("coaches").update({ user_id: user.id }).eq("id", coach.id);
    await supabase
      .from("conversations")
      .update({ coach_user_id: user.id })
      .eq("coach_id", coach.id)
      .is("coach_user_id", null);
    coach.user_id = user.id;
  }

  await applyEligibleFreeCoachOfferForUser({
    userId: user.id,
    email: user.email,
    coachId: coach.id,
  }).catch((error) => {
    console.error("[coach offers] automatic free offer application failed", {
      userId: user.id,
      coachId: coach.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    user,
    profile,
    coach,
    coachUserId: coach.user_id ?? user.id,
  };
}

export async function getAccountUserOrRedirect() {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    redirect("/account/login?error=missing-supabase");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/account/login");
  }

  const { profile } = await repairAccountForAuthUser(data.user);

  if (!profile) {
    redirect("/account/login?error=no-profile");
  }

  if (!["parent", "adult_player"].includes(profile.role) || !isActive(profile)) {
    redirect("/account/login?error=wrong-role");
  }

  if (!data.user.email_confirmed_at && !profile.email_verified_at) {
    redirect("/account/login?error=verify-email");
  }

  await syncVerifiedEmail(data.user.id, data.user.email_confirmed_at);

  return data.user;
}

export async function getAccountContextOrRedirect() {
  const user = await getAccountUserOrRedirect();
  const { profile } = await repairAccountForAuthUser(user);

  if (!profile || !["parent", "adult_player"].includes(profile.role) || !isActive(profile)) {
    redirect("/account/login?error=wrong-role");
  }

  return { user, profile };
}

export async function getRequestingAccountState() {
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return { status: "missing_config" as const };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return { status: "anonymous" as const };
  }

  const { profile, privateDetails } = await repairAccountForAuthUser(user);
  if (!profile) {
    return { status: "no_profile" as const, user };
  }

  if (!["parent", "adult_player"].includes(profile.role)) {
    return { status: "wrong_role" as const, user, profile };
  }

  if (profile.account_status !== "active") {
    return { status: "inactive" as const, user, profile };
  }

  if (!user.email_confirmed_at && !profile.email_verified_at) {
    return { status: "email_unverified" as const, user, profile };
  }

  if (user.email_confirmed_at && !profile.email_verified_at) {
    await syncVerifiedEmail(user.id, user.email_confirmed_at);
    profile.email_verified_at = user.email_confirmed_at;
  }

  const phoneVerifiedAt = privateDetails?.phone_verified_at ?? profile.phone_verified_at ?? user.phone_confirmed_at ?? null;

  if (!phoneVerifiedAt && !isPhoneVerificationBypassed()) {
    return { status: "phone_unverified" as const, user, profile, privateDetails };
  }

  return {
    status: "verified" as const,
    user,
    profile,
    privateDetails,
    phoneVerifiedAt: phoneVerifiedAt ?? new Date().toISOString(),
  };
}

export async function getAuthenticatedUserOrRedirect(loginPath = "/account/login") {
  if (!hasSupabaseConfig()) {
    redirect(`${loginPath}?error=missing-supabase`);
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(loginPath);
  }

  return data.user;
}
