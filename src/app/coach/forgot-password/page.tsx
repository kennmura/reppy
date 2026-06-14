import Link from "next/link";
import { requestCoachPasswordReset } from "@/lib/authActions";

const errors: Record<string, string> = {
  "missing-supabase": "Set Supabase environment variables before password reset works.",
  "missing-email": "Enter your email address.",
  "reset-failed": "The reset email could not be sent.",
};

export default async function CoachForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? errors[params.error] : null;

  return (
    <AuthPanel
      title="Reset coach password"
      body="Enter the email tied to your coach account. Supabase will send a recovery link."
      backHref="/account/login?role=coach"
      backLabel="Back to Sign In / Sign Up"
    >
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
      <form action={requestCoachPasswordReset} className="grid gap-4">
        <EmailField />
        <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
          Send reset link
        </button>
      </form>
    </AuthPanel>
  );
}

function AuthPanel({
  title,
  body,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  body: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href={backHref} className="text-sm font-medium text-[#12355b]">
            {backLabel}
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
          <div className="mt-6 grid gap-4">{children}</div>
        </div>
      </div>
    </main>
  );
}

function EmailField() {
  return (
    <label className="text-sm font-medium text-slate-800">
      Email
      <input
        name="email"
        type="email"
        required
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}
