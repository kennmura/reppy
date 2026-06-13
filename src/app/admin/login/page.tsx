import Link from "next/link";
import { signInAdmin } from "@/lib/actions";

const errorMessages: Record<string, string> = {
  "missing-fields": "Enter your email and password.",
  "invalid-login": "The email or password was not accepted.",
  "missing-admin-email": "Set ADMIN_EMAIL before using the admin area.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const message = params.error ? errorMessages[params.error] : null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f8f3] px-4 py-14">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-sm font-medium text-[#12355b]">
          Back to site
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">Admin sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use the Supabase Auth account matching ADMIN_EMAIL.
        </p>
        <form action={signInAdmin} className="mt-6 grid gap-4">
          <label className="text-sm font-medium text-slate-800">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Password
            <input
              name="password"
              type="password"
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            />
          </label>
          <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
            Sign in
          </button>
          {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}
