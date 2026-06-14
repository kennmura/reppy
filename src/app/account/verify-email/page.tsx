import Link from "next/link";
import { resendAccountConfirmation } from "@/lib/authActions";
import { getAuthenticatedUserOrRedirect } from "@/lib/auth";
import { isPhoneVerificationBypassed } from "@/lib/accountConfig";

const errors: Record<string, string> = {
  "missing-email": "This account does not have an email address.",
  "resend-failed": "Could not resend the confirmation email.",
  "rate-limited": "Please wait before requesting another confirmation email.",
};

export default async function AccountVerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; next?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthenticatedUserOrRedirect("/account/login");
  const defaultNext = isPhoneVerificationBypassed() ? "/account/dashboard" : "/account/verify-phone";
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : defaultNext;

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/account/dashboard" className="text-sm font-medium text-[#12355b]">
            Account
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Verify your email to request training.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Check the inbox for {user.email ?? "your account email"} and open the Supabase
            confirmation link.
          </p>
          {params.sent ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Confirmation email sent.
            </p>
          ) : null}
          {params.error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors[params.error] ?? "Email verification is required."}
            </p>
          ) : null}
          <form action={resendAccountConfirmation} className="mt-6">
            <input type="hidden" name="next" value={next} />
            <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Resend confirmation
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
