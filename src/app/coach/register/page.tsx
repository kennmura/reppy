import Link from "next/link";
import { registerCoach } from "@/lib/authActions";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before registering.",
  "missing-fields": "Enter your name, email, and password.",
  "weak-password": "Use a password with at least 8 characters.",
  "password-mismatch": "Passwords do not match.",
  "terms-required": "Accept the terms and privacy policy to continue.",
  "missing-location": "Enter your coaching location or ZIP code.",
  "register-failed": "The account could not be created. Try signing in or use another email.",
};

export default async function CoachRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/" className="text-sm font-medium text-[#12355b]">
            Back to site
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Register as a coach
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Create a Coach Account, verify your email, then complete your profile for review.
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <form action={registerCoach} className="mt-6 grid gap-4">
            <Field label="Full name" name="display_name" autoComplete="name" />
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field
              label="Coaching location or ZIP code"
              name="coach_location"
              autoComplete="postal-code"
              placeholder="Waltham, MA or 02453"
            />
            <Field label="Password" name="password" type="password" autoComplete="new-password" />
            <Field label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" />
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input name="terms" type="checkbox" required className="mt-1" />
              <span>
                I agree to the <Link href="/terms" className="font-semibold text-[#12355b]">Terms</Link> and{" "}
                <Link href="/privacy" className="font-semibold text-[#12355b]">Privacy Policy</Link>.
              </span>
            </label>
            <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Create coach account
            </button>
          </form>
          <p className="mt-5 text-sm text-slate-600">
            Already registered?{" "}
            <Link href="/account/login" className="font-semibold text-[#12355b]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}
