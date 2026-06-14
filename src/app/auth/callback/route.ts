import { type NextRequest, NextResponse } from "next/server";
import { repairAccountForAuthUser } from "@/lib/auth";
import { isPhoneVerificationBypassed } from "@/lib/accountConfig";
import { createSupabaseServerClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return null;
  }

  return value;
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

function unwrapPhoneVerificationNext(next: string | null, origin: string) {
  if (!next || !isPhoneVerificationBypassed() || !next.startsWith("/account/verify-phone")) {
    return next;
  }

  const nestedNext = safeNext(new URL(next, origin).searchParams.get("next"));
  return nestedNext ?? "/account/dashboard";
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

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=missing-admin-supabase`, requestUrl.origin));
  }

  try {
    const repaired = await repairAccountForAuthUser(user);
    profile = repaired.profile;
  } catch (error) {
    console.error("[authCallback] Failed to repair application account after Supabase callback", {
      userId: user.id,
      error: serializableSupabaseError(error),
    });
    return NextResponse.redirect(new URL(`${fallbackLogin}?error=profile-create-failed`, requestUrl.origin));
  }

  const resolvedNext = unwrapPhoneVerificationNext(next, requestUrl.origin);

  if (resolvedNext) {
    return NextResponse.redirect(new URL(resolvedNext, requestUrl.origin));
  }

  if (profile?.role === "coach") {
    return NextResponse.redirect(new URL("/coach/dashboard", requestUrl.origin));
  }

  if (profile?.role === "admin") {
    return NextResponse.redirect(new URL("/admin", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/account/dashboard", requestUrl.origin));
}
