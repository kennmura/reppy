import Link from "next/link";
import { resetAccountPassword } from "@/lib/authActions";

const errors: Record<string, string> = {
  "weak-password": "Use a password with at least 8 characters.",
  "password-mismatch": "Passwords do not match.",
  "reset-failed": "The password could not be updated.",
};

export default async function AccountResetPasswordPage({
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
          <Link href="/account/login" className="text-sm font-medium text-[#12355b]">
            Back to account sign in
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Choose a new password
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page works after opening the Supabase password recovery link.
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <form action={resetAccountPassword} className="mt-6 grid gap-4">
            <label className="text-sm font-medium text-slate-800">
              New password
              <input
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Confirm password
              <input
                name="confirm_password"
                type="password"
                required
                autoComplete="new-password"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Update password
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
