import Link from "next/link";
import { isMarketplaceVisible } from "@/lib/featureFlags";

export default function ContactPage() {
  const marketplaceVisible = isMarketplaceVisible();

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Contact Reppy</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">
          {marketplaceVisible
            ? "For now, create a Coach Account if you are a coach, or browse coach profiles to request training directly."
            : "For now, create a Coach Account if you coach teams, or use Reppy Passport to manage player development profiles and season handoffs."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={marketplaceVisible ? "/coaches" : "/account/passport"}
            className="rounded-md bg-[#12355b] px-5 py-3 text-center text-sm font-semibold text-white"
          >
            {marketplaceVisible ? "Find Coaches" : "Open Passport"}
          </Link>
          <Link href="/coach/register" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950">
            Join as a Coach
          </Link>
        </div>
      </div>
    </main>
  );
}
