import Link from "next/link";
import { signInAccount, signInCoach } from "@/lib/actions";

const errorMessages: Record<string, string> = {
  "missing-supabase": "Supabase environment variables are required before sign-in works.",
  "missing-fields": "Enter your email and password.",
  "invalid-login": "Invalid email or password.",
  "wrong-role": "Use the sign-in box that matches your account type.",
  "verify-email": "Verify your email before signing in.",
  "no-profile": "This auth user is missing an account profile record.",
  "expired-reset": "That password reset link expired. Request a new one.",
};

const successMessages: Record<string, string> = {
  "verify-email": "Check your email to verify your account.",
  "password-updated": "Password updated. Sign in with your new password.",
};

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;
  const success = params.message ? successMessages[params.message] : null;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "";

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Sign In / Sign Up
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Choose your account type
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Player, parent, and coach accounts stay separate so requests, profiles, and messages go
            to the right place.
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

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <AuthBox
            title="Player/Parent Account"
            body="For parents, guardians, and players looking for private coaching."
            action={signInAccount}
            forgotHref="/account/forgot-password"
            signupHref={next ? `/account/register?next=${encodeURIComponent(next)}` : "/account/register"}
            signupLabel="Create Player/Parent Account"
            hiddenFields={{ next }}
          />
          <AuthBox
            title="Coach Account"
            body="For coaches managing profiles, training requests, and messages."
            action={signInCoach}
            forgotHref="/coach/forgot-password"
            signupHref="/coach/register"
            signupLabel="Create Coach Account"
            hiddenFields={{ login_path: "/account/login" }}
          />
        </div>
      </div>
    </main>
  );
}

function AuthBox({
  title,
  body,
  action,
  forgotHref,
  signupHref,
  signupLabel,
  hiddenFields,
}: {
  title: string;
  body: string;
  action: (formData: FormData) => void | Promise<void>;
  forgotHref: string;
  signupHref: string;
  signupLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
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
    </section>
  );
}
