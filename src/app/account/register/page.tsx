import Link from "next/link";
import { AccountRegisterForm } from "@/components/account/AccountRegisterForm";
import { registerAccount } from "@/lib/authActions";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before registering.",
  "missing-public-supabase": "Account registration is not configured yet. Missing public Supabase settings.",
  "missing-admin-supabase": "Account registration is not fully configured yet. Missing secure server settings.",
  "missing-fields": "Enter your name, email, and password.",
  "weak-password": "Use a password with at least 8 characters.",
  "password-mismatch": "Passwords do not match.",
  "terms-required": "Accept the terms and privacy policy to continue.",
  "privacy-required": "Accept the privacy policy to continue.",
  "invalid-phone": "Enter a valid mobile phone number.",
  "signup-rate-limited": "Too many signup emails were requested. Please wait a few minutes and try again.",
  "signup-failed": "The account could not be created. Try signing in or use another email.",
  "profile-create-failed": "Registration started, but profile setup could not finish. Please try again.",
  "private-details-failed": "Registration started, but phone setup could not finish. Please try again.",
  "register-failed": "The account could not be created. Try signing in or use another email.",
};

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; display_name?: string; email?: string; phone?: string; role?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "";
  const defaultRole = params.role === "adult_player" ? "adult_player" : "parent";

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/" className="text-sm font-medium text-[#12355b]">
            Back to site
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Player/Parent Account
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Save preferences, send requests, and keep coach conversations in one place.
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <AccountRegisterForm
            action={registerAccount}
            next={next}
            defaultValues={{
              display_name: params.display_name ?? "",
              email: params.email ?? "",
              phone: params.phone ?? "",
              role: defaultRole,
            }}
          />
          <p className="mt-5 text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href={next ? `/account/login?next=${encodeURIComponent(next)}` : "/account/login"}
              className="font-semibold text-[#12355b]"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
