import Link from "next/link";
import { requestAccountPhoneOtp, verifyAccountPhoneOtp } from "@/lib/authActions";
import { getAccountContextOrRedirect, getAccountPrivateDetails } from "@/lib/auth";

const errors: Record<string, string> = {
  "invalid-phone": "Enter a valid mobile phone number.",
  "send-failed": "Could not send the verification code.",
  "missing-code": "Enter the verification code.",
  "invalid-code": "The verification code was not accepted.",
  "rate-limited": "Please wait before trying again.",
};

export default async function AccountVerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; next?: string }>;
}) {
  const params = await searchParams;
  const { user } = await getAccountContextOrRedirect();
  const privateDetails = await getAccountPrivateDetails(user.id);
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/account/dashboard";

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/account/settings" className="text-sm font-medium text-[#12355b]">
            Account settings
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Verify your phone
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Reppy requires a verified adult mobile number before training requests can be sent.
          </p>
          {params.sent ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Code sent. Enter it below.
            </p>
          ) : null}
          {params.error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors[params.error] ?? "Phone verification is required."}
            </p>
          ) : null}
          <form action={requestAccountPhoneOtp} className="mt-6 grid gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="text-sm font-medium text-slate-800">
              Mobile phone number
              <input
                name="phone"
                type="tel"
                required
                defaultValue={privateDetails?.phone_e164 ?? ""}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <button className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500">
              Send code
            </button>
          </form>
          <form action={verifyAccountPhoneOtp} className="mt-6 grid gap-4 border-t border-slate-200 pt-6">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="phone" value={privateDetails?.phone_e164 ?? ""} />
            <label className="text-sm font-medium text-slate-800">
              Verification code
              <input
                name="token"
                inputMode="numeric"
                required
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
              />
            </label>
            <button className="rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Verify phone
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
