import Link from "next/link";
import { registerAccount } from "@/lib/authActions";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before registering.",
  "missing-fields": "Enter your name, email, and password.",
  "weak-password": "Use a password with at least 8 characters.",
  "password-mismatch": "Passwords do not match.",
  "terms-required": "Accept the terms and privacy policy to continue.",
  "privacy-required": "Accept the privacy policy to continue.",
  "invalid-phone": "Enter a valid mobile phone number.",
  "register-failed": "The account could not be created. Try signing in or use another email.",
};

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "";

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
          <form action={registerAccount} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <Field label="Full name" name="display_name" autoComplete="name" />
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field label="Mobile phone number" name="phone" type="tel" autoComplete="tel" />
            <label className="text-sm font-medium text-slate-800">
              Account type
              <select
                name="role"
                defaultValue="parent"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              >
                <option value="parent">Parent or guardian</option>
                <option value="adult_player">Adult player</option>
              </select>
            </label>
            <Field label="Password" name="password" type="password" autoComplete="new-password" />
            <Field label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" />
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input name="terms" type="checkbox" required className="mt-1" />
              <span>
                I agree to the <Link href="/terms" className="font-semibold text-[#12355b]">Terms</Link>.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
              <input name="privacy" type="checkbox" required className="mt-1" />
              <span>
                I agree to the <Link href="/privacy" className="font-semibold text-[#12355b]">Privacy Policy</Link>.
              </span>
            </label>
            <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Create account
            </button>
          </form>
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

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}
