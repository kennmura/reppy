import { type NextRequest, NextResponse } from "next/server";
import { ensureApplicationProfile, getApplicationProfile } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "@/lib/supabase";
import type { UserProfile, UserRole } from "@/lib/types";

const roles: UserRole[] = ["coach", "parent", "adult_player", "admin"];

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return null;
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const fallbackLogin = "/account/login";

  if (!hasSupabaseConfig() || !code) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=invalid-link`, requestUrl.origin));
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=invalid-link`, requestUrl.origin));
  }

  const { data } = await supabaseAuth.auth.getUser();
  const user = data.user;

  if (!user) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=invalid-link`, requestUrl.origin));
  }

  let profile: UserProfile | null = null;

  if (hasSupabaseAdminConfig()) {
    profile = await getApplicationProfile(user.id);

    if (!profile) {
      const metadataRole = user.user_metadata?.role;
      const role = roles.includes(metadataRole) ? metadataRole : "parent";
      profile = await ensureApplicationProfile({
        userId: user.id,
        role,
        displayName: user.user_metadata?.full_name ?? user.email ?? "Reppy user",
        emailVerifiedAt: user.email_confirmed_at ?? null,
      });
    } else if (user.email_confirmed_at && !profile.email_verified_at) {
      const admin = createSupabaseAdminClient();
      await admin
        .from("user_profiles")
        .update({ email_verified_at: user.email_confirmed_at, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      profile = { ...profile, email_verified_at: user.email_confirmed_at };
    }
  }

  if (next) {
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (profile?.role === "coach") {
    return NextResponse.redirect(new URL("/coach/dashboard", requestUrl.origin));
  }

  if (profile?.role === "admin") {
    return NextResponse.redirect(new URL("/admin", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/account/dashboard", requestUrl.origin));
}
