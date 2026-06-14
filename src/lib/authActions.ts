"use server";

import { redirect } from "next/navigation";
import {
  ensureApplicationProfile,
  getAccountContextOrRedirect,
  getAccountPrivateDetails,
  getApplicationProfile,
  getAuthenticatedUserOrRedirect,
} from "./auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "./supabase";
import { isMissingCoachLocationColumnError, resolveCoachLocationFields } from "./location";
import type { UserRole } from "./types";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002";
  return new URL(path, base).toString();
}

function safeNext(value: string, fallback = "/account/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }

  return value;
}

function redirectAccountRegisterWithError(formData: FormData, error: string, next: string): never {
  const params = new URLSearchParams({ error });
  const preservedKeys = ["display_name", "email", "phone", "role"];

  for (const key of preservedKeys) {
    const value = textValue(formData, key);
    if (value) {
      params.set(key, value);
    }
  }

  if (next) {
    params.set("next", next);
  }

  redirect(`/account/register?${params.toString()}`);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function passwordPair(formData: FormData) {
  const password = textValue(formData, "password");
  const confirmPassword = textValue(formData, "confirm_password");

  if (password.length < 8) {
    return { password, error: "weak-password" };
  }

  if (password !== confirmPassword) {
    return { password, error: "password-mismatch" };
  }

  return { password, error: null };
}

function normalizePhoneE164(value: string) {
  const trimmed = value.replace(/[^\d+]/g, "");
  if (!trimmed) {
    return "";
  }

  const withCountry = trimmed.startsWith("+") ? trimmed : `+1${trimmed.replace(/^1/, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(withCountry) ? withCountry : "";
}

async function registerUser({
  formData,
  role,
  loginPath,
  registerPath,
  onboardingPath,
  extraMetadata = {},
  afterProfileCreated,
}: {
  formData: FormData;
  role: UserRole;
  loginPath: string;
  registerPath?: string;
  onboardingPath: string;
  extraMetadata?: Record<string, string>;
  afterProfileCreated?: (context: {
    userId: string;
    displayName: string;
    email: string;
  }) => Promise<void>;
}) {
  const resolvedRegisterPath = registerPath ?? loginPath.replace("/login", "/register");

  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    redirect(`${resolvedRegisterPath}?error=missing-supabase`);
  }

  const displayName = textValue(formData, "display_name");
  const email = textValue(formData, "email").toLowerCase();
  const { password, error: passwordError } = passwordPair(formData);
  const acceptedTerms = formData.get("terms") === "on";

  if (!displayName || !email || !password) {
    redirect(`${resolvedRegisterPath}?error=missing-fields`);
  }

  if (passwordError) {
    redirect(`${resolvedRegisterPath}?error=${passwordError}`);
  }

  if (!acceptedTerms) {
    redirect(`${resolvedRegisterPath}?error=terms-required`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(onboardingPath)}`),
      data: {
        full_name: displayName,
        role,
        ...extraMetadata,
      },
    },
  });

  if (error || !data.user) {
    redirect(`${resolvedRegisterPath}?error=register-failed`);
  }

  await ensureApplicationProfile({
    userId: data.user.id,
    role,
    displayName,
    emailVerifiedAt: data.user.email_confirmed_at ?? null,
  });

  if (afterProfileCreated) {
    await afterProfileCreated({
      userId: data.user.id,
      displayName,
      email,
    });
  }

  if (data.session && data.user.email_confirmed_at) {
    redirect(onboardingPath);
  }

  redirect(`${loginPath}?message=verify-email`);
}

export async function registerCoach(formData: FormData) {
  const location = textValue(formData, "coach_location");

  if (!location) {
    redirect("/coach/register?error=missing-location");
  }

  await registerUser({
    formData,
    role: "coach",
    loginPath: "/account/login",
    registerPath: "/coach/register",
    onboardingPath: "/coach/onboarding",
    extraMetadata: {
      coach_location: location,
    },
    afterProfileCreated: async ({ userId, displayName, email }) => {
      await seedCoachProfileFromSignup({
        userId,
        displayName,
        email,
        location,
      });
    },
  });
}

async function seedCoachProfileFromSignup({
  userId,
  displayName,
  email,
  location,
}: {
  userId: string;
  displayName: string;
  email: string;
  location: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const resolvedLocation = resolveCoachLocationFields({ location });
  const slug = `${slugify(displayName || email || "coach") || "coach"}-${userId.slice(0, 8)}`;
  const payload = {
    user_id: userId,
    full_name: displayName || email || "Coach",
    slug,
    email,
    location,
    public_location: resolvedLocation.public_location,
    city: resolvedLocation.city,
    state: resolvedLocation.state,
    zip_code: resolvedLocation.zip_code,
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
    service_radius_miles: 30,
    pricing_text: "Pricing available upon request.",
    profile_status: "draft",
    is_published: false,
    accepting_requests: false,
    updated_at: now,
  };
  const { data: existing, error: existingError } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw existingError;
  }

  const write = existing
    ? supabase.from("coaches").update(payload).eq("id", existing.id)
    : supabase.from("coaches").insert({ ...payload, created_at: now });
  let { error } = await write;

  if (error && isMissingCoachLocationColumnError(error)) {
    const legacyPayload: Record<string, string | number | boolean | null> = { ...payload };
    delete legacyPayload.city;
    delete legacyPayload.state;
    delete legacyPayload.zip_code;
    delete legacyPayload.latitude;
    delete legacyPayload.longitude;
    delete legacyPayload.public_location;
    delete legacyPayload.service_radius_miles;
    const legacyWrite = existing
      ? supabase.from("coaches").update(legacyPayload).eq("id", existing.id)
      : supabase.from("coaches").insert({ ...legacyPayload, created_at: now });
    const fallback = await legacyWrite;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }
}

export async function registerAccount(formData: FormData) {
  const role = textValue(formData, "role") === "adult_player" ? "adult_player" : "parent";
  const phone = normalizePhoneE164(textValue(formData, "phone"));
  const acceptedPrivacy = formData.get("privacy") === "on";
  const next = safeNext(textValue(formData, "next"), "/account/dashboard");

  if (!phone) {
    redirectAccountRegisterWithError(formData, "invalid-phone", next);
  }

  if (!acceptedPrivacy) {
    redirectAccountRegisterWithError(formData, "privacy-required", next);
  }

  const displayName = textValue(formData, "display_name");
  const email = textValue(formData, "email").toLowerCase();
  const { password, error: passwordError } = passwordPair(formData);
  const acceptedTerms = formData.get("terms") === "on";

  if (!displayName || !email || !password) {
    redirectAccountRegisterWithError(formData, "missing-fields", next);
  }

  if (passwordError) {
    redirectAccountRegisterWithError(formData, passwordError, next);
  }

  if (!acceptedTerms) {
    redirectAccountRegisterWithError(formData, "terms-required", next);
  }

  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    redirectAccountRegisterWithError(formData, "missing-supabase", next);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl(
        `/auth/callback?next=${encodeURIComponent(`/account/verify-phone?next=${encodeURIComponent(next)}`)}`,
      ),
      data: {
        full_name: displayName,
        role,
      },
    },
  });

  if (error || !data.user) {
    redirectAccountRegisterWithError(formData, "register-failed", next);
  }

  await ensureApplicationProfile({
    userId: data.user.id,
    role,
    displayName,
    emailVerifiedAt: data.user.email_confirmed_at ?? null,
  });

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin.from("account_private_details").upsert(
    {
      user_id: data.user.id,
      phone_e164: phone,
      phone_verified_at: null,
      account_type: role,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (data.session && data.user.email_confirmed_at) {
    redirect(`/account/verify-phone?next=${encodeURIComponent(next)}`);
  }

  redirect(`/account/login?message=verify-email&next=${encodeURIComponent(next)}`);
}

export async function registerAccountLegacy(formData: FormData) {
  const role = textValue(formData, "role") === "adult_player" ? "adult_player" : "parent";
  await registerUser({
    formData,
    role,
    loginPath: "/account/login",
    onboardingPath: "/account/onboarding",
  });
}

async function requestPasswordReset({
  formData,
  loginPath,
  resetPath,
}: {
  formData: FormData;
  loginPath: string;
  resetPath: string;
}) {
  if (!hasSupabaseConfig()) {
    redirect(`${loginPath.replace("/login", "/forgot-password")}?error=missing-supabase`);
  }

  const email = textValue(formData, "email").toLowerCase();
  if (!email) {
    redirect(`${loginPath.replace("/login", "/forgot-password")}?error=missing-email`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(resetPath)}`),
  });

  if (error) {
    redirect(`${loginPath.replace("/login", "/forgot-password")}?error=reset-failed`);
  }

  redirect(`${loginPath.replace("/login", "/forgot-password")}?sent=1`);
}

export async function requestCoachPasswordReset(formData: FormData) {
  await requestPasswordReset({
    formData,
    loginPath: "/coach/login",
    resetPath: "/coach/reset-password",
  });
}

export async function requestAccountPasswordReset(formData: FormData) {
  await requestPasswordReset({
    formData,
    loginPath: "/account/login",
    resetPath: "/account/reset-password",
  });
}

async function resetPassword({
  formData,
  loginPath,
}: {
  formData: FormData;
  loginPath: string;
}) {
  if (!hasSupabaseConfig()) {
    redirect(`${loginPath}?error=missing-supabase`);
  }

  const { password, error: passwordError } = passwordPair(formData);
  if (passwordError) {
    redirect(`${loginPath.replace("/login", "/reset-password")}?error=${passwordError}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`${loginPath}?error=expired-reset`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`${loginPath.replace("/login", "/reset-password")}?error=reset-failed`);
  }

  redirect(`${loginPath}?message=password-updated`);
}

export async function resetCoachPassword(formData: FormData) {
  await resetPassword({ formData, loginPath: "/coach/login" });
}

export async function resetAccountPassword(formData: FormData) {
  await resetPassword({ formData, loginPath: "/account/login" });
}

export async function syncProfileEmailVerification(userId: string, emailVerifiedAt: string | null) {
  if (!emailVerifiedAt || !hasSupabaseAdminConfig()) {
    return;
  }

  const existing = await getApplicationProfile(userId);
  if (!existing) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("user_profiles")
    .update({ email_verified_at: emailVerifiedAt, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function resendAccountConfirmation(formData: FormData) {
  const user = await getAuthenticatedUserOrRedirect("/account/login");
  const next = safeNext(textValue(formData, "next"), "/account/verify-phone");

  if (!user.email) {
    redirect("/account/verify-email?error=missing-email");
  }

  const privateDetails = await getAccountPrivateDetails(user.id);
  const lastSent = privateDetails?.otp_last_sent_at ? new Date(privateDetails.otp_last_sent_at).getTime() : 0;

  if (lastSent && Date.now() - lastSent < 60 * 1000) {
    redirect(`/account/verify-email?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: {
      emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) {
    redirect(`/account/verify-email?error=resend-failed&next=${encodeURIComponent(next)}`);
  }

  const admin = createSupabaseAdminClient();
  await admin.from("account_private_details").upsert(
    {
      user_id: user.id,
      otp_last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  redirect(`/account/verify-email?sent=1&next=${encodeURIComponent(next)}`);
}

export async function requestAccountPhoneOtp(formData: FormData) {
  const { user, profile } = await getAccountContextOrRedirect();
  const phone = normalizePhoneE164(textValue(formData, "phone"));
  const next = safeNext(textValue(formData, "next"), "/account/dashboard");

  if (!phone) {
    redirect(`/account/verify-phone?error=invalid-phone&next=${encodeURIComponent(next)}`);
  }

  const privateDetails = await getAccountPrivateDetails(user.id);
  const now = Date.now();
  const windowStarted = privateDetails?.otp_window_started_at
    ? new Date(privateDetails.otp_window_started_at).getTime()
    : 0;
  const withinWindow = windowStarted && now - windowStarted < 15 * 60 * 1000;
  const sendCount = withinWindow ? privateDetails?.otp_send_count ?? 0 : 0;
  const lastSent = privateDetails?.otp_last_sent_at ? new Date(privateDetails.otp_last_sent_at).getTime() : 0;

  if (lastSent && now - lastSent < 60 * 1000) {
    redirect(`/account/verify-phone?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  if (sendCount >= 3) {
    redirect(`/account/verify-phone?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ phone });

  if (error) {
    redirect(`/account/verify-phone?error=send-failed&next=${encodeURIComponent(next)}`);
  }

  const admin = createSupabaseAdminClient();
  const isoNow = new Date().toISOString();
  await admin.from("account_private_details").upsert(
    {
      user_id: user.id,
      phone_e164: phone,
      phone_verified_at: null,
      account_type: profile.role,
      otp_send_count: sendCount + 1,
      otp_verify_attempt_count: withinWindow ? privateDetails?.otp_verify_attempt_count ?? 0 : 0,
      otp_last_sent_at: isoNow,
      otp_window_started_at: withinWindow ? privateDetails?.otp_window_started_at : isoNow,
      updated_at: isoNow,
    },
    { onConflict: "user_id" },
  );

  redirect(`/account/verify-phone?sent=1&next=${encodeURIComponent(next)}`);
}

export async function verifyAccountPhoneOtp(formData: FormData) {
  const { user, profile } = await getAccountContextOrRedirect();
  const phone = normalizePhoneE164(textValue(formData, "phone"));
  const token = textValue(formData, "token").replace(/\s+/g, "");
  const next = safeNext(textValue(formData, "next"), "/account/dashboard");

  if (!phone || !token) {
    redirect(`/account/verify-phone?error=missing-code&next=${encodeURIComponent(next)}`);
  }

  const privateDetails = await getAccountPrivateDetails(user.id);
  const windowStarted = privateDetails?.otp_window_started_at
    ? new Date(privateDetails.otp_window_started_at).getTime()
    : 0;
  const withinWindow = windowStarted && Date.now() - windowStarted < 15 * 60 * 1000;
  const attemptCount = withinWindow ? privateDetails?.otp_verify_attempt_count ?? 0 : 0;

  if (attemptCount >= 5) {
    redirect(`/account/verify-phone?error=rate-limited&next=${encodeURIComponent(next)}`);
  }

  const admin = createSupabaseAdminClient();
  const isoNow = new Date().toISOString();
  await admin.from("account_private_details").upsert(
    {
      user_id: user.id,
      phone_e164: phone,
      account_type: profile.role,
      otp_verify_attempt_count: attemptCount + 1,
      otp_window_started_at: withinWindow ? privateDetails?.otp_window_started_at : isoNow,
      updated_at: isoNow,
    },
    { onConflict: "user_id" },
  );

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });

  if (error) {
    redirect(`/account/verify-phone?error=invalid-code&next=${encodeURIComponent(next)}`);
  }

  await admin.from("account_private_details").upsert(
    {
      user_id: user.id,
      phone_e164: phone,
      phone_verified_at: isoNow,
      account_type: profile.role,
      otp_send_count: 0,
      otp_verify_attempt_count: 0,
      updated_at: isoNow,
    },
    { onConflict: "user_id" },
  );
  await admin
    .from("user_profiles")
    .update({ phone_verified_at: isoNow, updated_at: isoNow })
    .eq("id", user.id);

  redirect(next);
}
