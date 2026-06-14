"use server";

import { redirect } from "next/navigation";
import {
  ensureAccountPrivateDetails,
  ensureApplicationProfile,
  getAccountContextOrRedirect,
  getAccountPrivateDetails,
  getApplicationProfile,
  getAuthenticatedUserOrRedirect,
} from "./auth";
import { isPhoneVerificationBypassed } from "./accountConfig";
import { calculateAgeFromDateOfBirth, isReasonablePlayerDateOfBirth } from "./accountProfile";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
  hasSupabasePublicConfig,
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
  const preservedKeys = ["player_name", "guardian_name", "player_date_of_birth", "display_name", "email", "phone", "role"];

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

function serializableSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    status: typeof record.status === "number" || typeof record.status === "string" ? record.status : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    hint: typeof record.hint === "string" ? record.hint : undefined,
  };
}

function signupErrorCode(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  if (record.code === "over_email_send_rate_limit" || record.status === 429) {
    return "signup-rate-limited";
  }

  return "signup-failed";
}

async function cleanupNewAuthUser(userId: string, reason: string) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[registerAccount] Failed to clean up auth user after registration failure", {
        reason,
        userId,
        error: serializableSupabaseError(error),
      });
    }
  } catch (error) {
    console.error("[registerAccount] Failed to clean up auth user after registration failure", {
      reason,
      userId,
      error: serializableSupabaseError(error),
    });
  }
}

async function findAuthUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      console.error("[registerAccount] Could not precheck duplicate auth email", {
        error: serializableSupabaseError(error),
      });
      return null;
    }

    const existing = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (existing) {
      return existing;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  console.error("[registerAccount] Duplicate email precheck reached the pagination limit");
  return null;
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

  const duplicateAuthUser = await findAuthUserByEmail(email);
  if (duplicateAuthUser) {
    console.error("[registerUser] Duplicate registration blocked", {
      role,
      existingUserId: duplicateAuthUser.id,
    });
    redirect(`${resolvedRegisterPath}?error=email-already-registered`);
  }

  const supabase = await createSupabaseServerClient();
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

  if (!data.user.identities?.length) {
    console.error("[registerUser] Supabase signUp did not create a new auth identity", {
      role,
      userId: data.user.id,
    });
    redirect(`${resolvedRegisterPath}?error=email-already-registered`);
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
  const city = textValue(formData, "city");
  const state = textValue(formData, "state").toUpperCase();
  const zipCode = textValue(formData, "zip_code");
  const location = [city, state].filter(Boolean).join(", ") || zipCode;
  const latitude = textValue(formData, "latitude");
  const longitude = textValue(formData, "longitude");
  const timezone = textValue(formData, "timezone") || "America/New_York";

  if (!city || !state || !zipCode) {
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
      coach_city: city,
      coach_state: state,
      coach_zip_code: zipCode,
    },
    afterProfileCreated: async ({ userId, displayName, email }) => {
      await seedCoachProfileFromSignup({
        userId,
        displayName,
        email,
        location,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        timezone,
      });
    },
  });
}

async function seedCoachProfileFromSignup({
  userId,
  displayName,
  email,
  location,
  city,
  state,
  zipCode,
  latitude,
  longitude,
  timezone,
}: {
  userId: string;
  displayName: string;
  email: string;
  location: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const resolvedLocation = resolveCoachLocationFields({ location, city, state, zipCode });
  const parsedLatitude = Number.parseFloat(latitude);
  const parsedLongitude = Number.parseFloat(longitude);
  const hasBrowserCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
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
    latitude: hasBrowserCoordinates ? parsedLatitude : resolvedLocation.latitude,
    longitude: hasBrowserCoordinates ? parsedLongitude : resolvedLocation.longitude,
    timezone,
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
    delete legacyPayload.timezone;
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
  const next = safeNext(textValue(formData, "next"), "/account/settings?error=missing-player-profile");

  if (!phone) {
    redirectAccountRegisterWithError(formData, "invalid-phone", next);
  }

  if (!acceptedPrivacy) {
    redirectAccountRegisterWithError(formData, "privacy-required", next);
  }

  const playerName = textValue(formData, "player_name") || textValue(formData, "display_name");
  const guardianName = textValue(formData, "guardian_name");
  const playerDateOfBirth = textValue(formData, "player_date_of_birth");
  const displayName = playerName;
  const email = textValue(formData, "email").toLowerCase();
  const { password, error: passwordError } = passwordPair(formData);
  const acceptedTerms = formData.get("terms") === "on";

  if (!playerName || !playerDateOfBirth || !email || !password || (role === "parent" && !guardianName)) {
    redirectAccountRegisterWithError(formData, "missing-fields", next);
  }

  if (!isReasonablePlayerDateOfBirth(playerDateOfBirth)) {
    redirectAccountRegisterWithError(formData, "invalid-dob", next);
  }

  if (passwordError) {
    redirectAccountRegisterWithError(formData, passwordError, next);
  }

  if (!acceptedTerms) {
    redirectAccountRegisterWithError(formData, "terms-required", next);
  }

  if (!hasSupabasePublicConfig()) {
    console.error("[registerAccount] Missing public Supabase config for account registration");
    redirectAccountRegisterWithError(formData, "missing-public-supabase", next);
  }

  if (!hasSupabaseAdminConfig()) {
    console.error("[registerAccount] Missing Supabase service role config for account registration");
    redirectAccountRegisterWithError(formData, "missing-admin-supabase", next);
  }

  const admin = createSupabaseAdminClient();
  const phoneBypassed = isPhoneVerificationBypassed();
  const duplicateAuthUser = await findAuthUserByEmail(email);

  if (duplicateAuthUser) {
    console.error("[registerAccount] Duplicate account registration blocked", {
      role,
      existingUserId: duplicateAuthUser.id,
    });
    redirectAccountRegisterWithError(formData, "email-already-registered", next);
  }

  console.info("[registerAccount] Starting account registration", {
    role,
    phoneVerificationBypassed: phoneBypassed,
  });

  const supabase = await createSupabaseServerClient();
  const callbackNext = phoneBypassed ? next : `/account/verify-phone?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(callbackNext)}`),
      data: {
        full_name: displayName,
        role,
      },
    },
  });

  if (error || !data.user) {
    console.error("[registerAccount] Supabase auth signup failed", {
      role,
      error: serializableSupabaseError(error ?? new Error("Supabase signUp returned no user")),
    });
    redirectAccountRegisterWithError(formData, signupErrorCode(error), next);
  }

  const createdNewAuthUser = Boolean(data.user.identities?.length);
  if (!createdNewAuthUser) {
    console.error("[registerAccount] Supabase signUp did not create a new auth identity", {
      role,
      userId: data.user.id,
    });
    redirectAccountRegisterWithError(formData, "email-already-registered", next);
  }

  const { data: confirmedAuthUser, error: getUserError } = await admin.auth.admin.getUserById(data.user.id);
  if (getUserError || !confirmedAuthUser.user) {
    console.error("[registerAccount] Supabase auth user was not readable after signup", {
      role,
      userId: data.user.id,
      error: serializableSupabaseError(getUserError ?? new Error("Admin getUserById returned no user")),
    });
    await cleanupNewAuthUser(data.user.id, "signup-not-created");
    redirectAccountRegisterWithError(formData, "signup-not-created", next);
  }

  try {
    await ensureApplicationProfile({
      userId: data.user.id,
      role,
      displayName,
      emailVerifiedAt: data.user.email_confirmed_at ?? null,
      phoneVerifiedAt: phoneBypassed ? new Date().toISOString() : data.user.phone_confirmed_at ?? null,
    });
  } catch (profileError) {
    console.error("[registerAccount] Failed to create user profile", {
      userId: data.user.id,
      role,
      error: serializableSupabaseError(profileError),
    });
    if (createdNewAuthUser) {
      await cleanupNewAuthUser(data.user.id, "profile-create-failed");
    }
    redirectAccountRegisterWithError(formData, "profile-create-failed", next);
  }

  try {
    await ensureAccountPrivateDetails({
      userId: data.user.id,
      accountType: role,
      phoneE164: phone,
      phoneVerifiedAt: phoneBypassed ? new Date().toISOString() : data.user.phone_confirmed_at ?? null,
      playerDateOfBirth,
    });
  } catch (privateDetailsError) {
    console.error("[registerAccount] Failed to upsert private account details", {
      userId: data.user.id,
      role,
      error: serializableSupabaseError(privateDetailsError),
    });
    if (createdNewAuthUser) {
      await cleanupNewAuthUser(data.user.id, "private-details-failed");
    }
    redirectAccountRegisterWithError(formData, "private-details-failed", next);
  }

  try {
    const { error: preferenceError } = await admin.from("user_coaching_preferences").upsert(
      {
        user_id: data.user.id,
        player_name: playerName,
        guardian_name: guardianName || null,
        player_age: String(calculateAgeFromDateOfBirth(playerDateOfBirth) ?? ""),
        player_birth_date: playerDateOfBirth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (preferenceError) {
      console.error("[registerAccount] Failed to seed player profile fields", {
        userId: data.user.id,
        role,
        error: serializableSupabaseError(preferenceError),
      });
    }
  } catch (preferenceError) {
    console.error("[registerAccount] Failed to seed player profile fields", {
      userId: data.user.id,
      role,
      error: serializableSupabaseError(preferenceError),
    });
  }

  if (data.session && data.user.email_confirmed_at) {
    console.info("[registerAccount] Account registration completed with immediate session", {
      role,
      userId: data.user.id,
      phoneVerificationBypassed: phoneBypassed,
    });
    redirect(phoneBypassed ? next : `/account/verify-phone?next=${encodeURIComponent(next)}`);
  }

  console.info("[registerAccount] Account registration completed; email verification required", {
    role,
    userId: data.user.id,
    phoneVerificationBypassed: phoneBypassed,
  });
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
  const next = safeNext(textValue(formData, "next"), isPhoneVerificationBypassed() ? "/account/dashboard" : "/account/verify-phone");

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
