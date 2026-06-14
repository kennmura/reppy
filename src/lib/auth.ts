import { redirect } from "next/navigation";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "./supabase";
import type { AccountPrivateDetails, Coach, UserProfile, UserRole } from "./types";

function isActive(profile: UserProfile | null) {
  return profile?.account_status === "active";
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
}: {
  userId: string;
  role: UserRole;
  displayName: string;
  emailVerifiedAt?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: userId,
        role,
        display_name: displayName || "Reppy user",
        account_status: "active",
        email_verified_at: emailVerifiedAt ?? null,
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

  const profile = await getApplicationProfile(data.user.id);

  if (!profile) {
    redirect("/account/login?error=no-profile");
  }

  if (!["parent", "adult_player"].includes(profile.role) || !isActive(profile)) {
    redirect("/account/login?error=wrong-role");
  }

  if (!data.user.email_confirmed_at) {
    redirect("/account/login?error=verify-email");
  }

  await syncVerifiedEmail(data.user.id, data.user.email_confirmed_at);

  return data.user;
}

export async function getAccountContextOrRedirect() {
  const user = await getAccountUserOrRedirect();
  const profile = await getApplicationProfile(user.id);

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

  const profile = await getApplicationProfile(user.id);
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

  const privateDetails = await getAccountPrivateDetails(user.id);
  const phoneVerifiedAt = privateDetails?.phone_verified_at ?? profile.phone_verified_at ?? user.phone_confirmed_at ?? null;

  if (!phoneVerifiedAt) {
    return { status: "phone_unverified" as const, user, profile, privateDetails };
  }

  return {
    status: "verified" as const,
    user,
    profile,
    privateDetails,
    phoneVerifiedAt,
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
