import Link from "next/link";
import { signInAccount, signInCoach } from "@/lib/actions";

const errorMessages: Record<string, string> = {
  "missing-supabase": "Supabase environment variables are required before sign-in works.",
  "missing-fields": "Enter your email and password.",
  "invalid-login": "Invalid email or password.",
  "wrong-role": "Use the sign-in box that matches your account type.",
  "verify-email": "Verify your email before signing in.",
  "no-profile": "This auth user is missing an account profile record.",
  "missing-admin-supabase": "Account access is not fully configured yet. Missing secure server settings.",
  "profile-create-failed": "Your sign-in worked, but account setup could not finish. Please try again.",
  "invalid-session": "Your session could not be confirmed. Please sign in again.",
  "expired-reset": "That password reset link expired. Request a new one.",
};

const successMessages: Record<string, string> = {
  "verify-email": "Check your email to verify your account.",
  "password-updated": "Password updated. Sign in with your new password.",
};

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string; role?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;
  const success = params.message ? successMessages[params.message] : null;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "";
  const isCoachLogin = params.role === "coach";

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Sign In / Sign Up
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            {isCoachLogin ? "Coach Account" : "Player/Parent Account"}
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            {isCoachLogin
              ? "Sign in to manage your coach profile, requests, and messages."
              : "Sign in to request training, save coaches, and continue conversations."}
          </p>
        </div>

        {success ? (
          <p className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <AuthBox
          title={isCoachLogin ? "Coach Account" : "Player/Parent Account"}
          action={isCoachLogin ? signInCoach : signInAccount}
          forgotHref={isCoachLogin ? "/coach/forgot-password" : "/account/forgot-password"}
          signupHref={isCoachLogin ? "/coach/register" : next ? `/account/register?next=${encodeURIComponent(next)}` : "/account/register"}
          signupLabel={isCoachLogin ? "Create Coach Account" : "Create Player/Parent Account"}
          alternateHref={isCoachLogin ? "/account/login" : "/account/login?role=coach"}
          alternateLabel={isCoachLogin ? "Looking for training? Sign in as a player/parent." : "Are you a coach? Sign in here."}
          hiddenFields={isCoachLogin ? { login_path: "/account/login?role=coach" } : { next }}
        />
      </div>
    </main>
  );
}

function AuthBox({
  title,
  action,
  forgotHref,
  signupHref,
  signupLabel,
  alternateHref,
  alternateLabel,
  hiddenFields,
}: {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  forgotHref: string;
  signupHref: string;
  signupLabel: string;
  alternateHref: string;
  alternateLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title === "Coach Account" ? "Coach sign in" : "Sign in"}
      </h2>
      <form action={action} className="mt-6 grid gap-4">
        {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="text-sm font-medium text-slate-800">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          />
        </label>
        <Link href={forgotHref} className="-mt-2 text-sm font-medium text-[#12355b]">
          Forgot password?
        </Link>
        <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
          Sign in
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        New here?{" "}
        <Link href={signupHref} className="font-semibold text-[#12355b]">
          {signupLabel}
        </Link>
      </p>
      <p className="mt-3 text-sm text-slate-600">
        <Link href={alternateHref} className="font-semibold text-[#12355b]">
          {alternateLabel}
        </Link>
      </p>
    </section>
  );
}
