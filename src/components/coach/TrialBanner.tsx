import { activateCoachTrial } from "@/lib/actions";
import { formatAccessBanner } from "@/lib/entitlements";
import type { MessageAccess } from "@/lib/types";

export function TrialBanner({ access }: { access: MessageAccess }) {
  const banner = formatAccessBanner(access);

  if (banner) {
    return (
      <div className="rounded-lg border border-[#d7e5dc] bg-[#f3f8f5] p-4 text-sm text-slate-700">
        <p className="font-semibold text-[#12355b]">{banner.title}</p>
        <p className="mt-1">{banner.body}</p>
        {banner.warning ? <p className="mt-2 font-medium text-amber-800">{banner.warning}</p> : null}
      </div>
    );
  }

  if (access.hasAccess) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="font-semibold text-slate-950">Start your seven-day premium trial</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Unlock full Message Centre access, replies, conversation history, and player records.
      </p>
      <form action={activateCoachTrial} className="mt-4">
        <button className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]">
          Start Free Trial
        </button>
      </form>
    </div>
  );
}
