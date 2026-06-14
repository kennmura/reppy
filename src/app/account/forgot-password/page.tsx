import Link from "next/link";
import { requestAccountPasswordReset } from "@/lib/authActions";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before password reset works.",
  "missing-email": "Enter your email address.",
  "reset-failed": "The reset email could not be sent.",
};

export default async function AccountForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
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
            Reset account password
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your parent or player account email. Supabase will send a recovery link.
          </p>
          <div className="mt-6 grid gap-4">
            {params.sent ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Check your email for a password reset link.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <form action={requestAccountPasswordReset} className="grid gap-4">
              <label className="text-sm font-medium text-slate-800">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
                />
              </label>
              <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Send reset link
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
