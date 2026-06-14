import Link from "next/link";
import { CoachRegisterForm } from "@/components/coach/CoachRegisterForm";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before registering.",
  "missing-fields": "Enter your name, email, and password.",
  "weak-password": "Use a password with at least 8 characters.",
  "password-mismatch": "Passwords do not match.",
  "terms-required": "Accept the terms and privacy policy to continue.",
  "missing-location": "Enter your coaching city, state, and ZIP code.",
  "email-already-registered": "An account already exists for that email. Try signing in instead.",
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
          <CoachRegisterForm />
          <p className="mt-5 text-sm text-slate-600">
            Already registered?{" "}
            <Link href="/account/login" className="font-semibold text-[#12355b]">
              Sign in
            </Link>
          </p>
          <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
            Looking for training?{" "}
            <Link href="/account/register" className="font-semibold text-[#12355b]">
              Create a player/parent account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
