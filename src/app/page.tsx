import Link from "next/link";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { CoachCard } from "@/components/CoachCard";
import { getPublishedCoaches } from "@/lib/data";
import { sports, sportToSlug } from "@/lib/sports";

const trustPoints = [
  "Verified coach profiles",
  "Parent-safe messaging",
  "Local private training",
  "Free to browse",
];

const browseSports = [
  "Soccer",
  "Basketball",
  "Baseball",
  "Tennis",
  "Golf",
  "Strength & Conditioning",
];

export default async function Home() {
  const featuredCoaches = (await getPublishedCoaches()).slice(0, 6);

  return (
    <main>
      <section className="bg-[#f7f8f3]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_0.95fr] md:items-center lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Local Sports Coaching
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Find trusted private coaches near you.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Search local coaches, view profiles, and request private training in minutes.
            </p>
            <div className="mt-8 grid gap-3 sm:flex">
              <Link
                href="/coaches"
                className="inline-flex items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
              >
                Find Coaches
              </Link>
              <Link
                href="/coach/register"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-slate-500"
              >
                Join as a Coach
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div
              role="img"
              aria-label="Local sports coach training a youth athlete"
              className="h-64 overflow-hidden rounded-md bg-[url('/images/soccer-training-hero.png')] bg-cover bg-center sm:h-80"
            />
            <form action="/coaches" className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-slate-800">
                Sport
                <select
                  name="sport"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
                >
                  <option value="">Any sport</option>
                  {sports.map((sport) => (
                    <option key={sport} value={sportToSlug(sport)}>
                      {sport}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-800">
                Location / ZIP
                <input
                  name="location"
                  placeholder="City, town, or ZIP code"
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
                />
              </label>
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                <Search className="h-4 w-4" />
                Search Coaches
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-5">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {trustPoints.map((point) => (
            <div key={point} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-[#2f6f5e]" />
              {point}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Browse by Sport</h2>
              <p className="mt-3 max-w-2xl text-slate-700">
                Start with a sport, then narrow by location and training style.
              </p>
            </div>
            <Link href="/coaches" className="text-sm font-semibold text-[#12355b] hover:text-[#0d2948]">
              View all coaches
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {browseSports.map((sport) => (
              <Link
                key={sport}
                href={`/coaches?sport=${sportToSlug(sport)}`}
                className="rounded-lg border border-slate-200 bg-[#f7f8f3] p-5 text-sm font-semibold text-slate-950 hover:border-slate-400"
              >
                {sport}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f3] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step number="1" title="Search nearby coaches" body="Filter by sport, location, and training style." />
            <Step number="2" title="View profiles and services" body="Compare experience, age groups, pricing notes, and availability." />
            <Step number="3" title="Send a training request" body="Use a Player/Parent Account to start a private conversation." />
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
                Featured Coaches
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Start with trusted local profiles
              </h2>
            </div>
            <Link href="/coaches" className="text-sm font-semibold text-[#12355b] hover:text-[#0d2948]">
              Find Coaches
            </Link>
          </div>
          {featuredCoaches.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {featuredCoaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No published coaches yet"
              body="Coach profiles will appear here after they are reviewed and published."
              href="/coach/register"
              label="Create Coach Account"
            />
          )}
        </div>
      </section>

      <section className="bg-[#f7f8f3] py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Coach Accounts
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Coach on your terms.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              Build a profile, receive requests, and manage conversations in one place.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Professional public coach profile",
                "Services, pricing, and availability",
                "Photo and cover image editing",
                "Message Center training requests",
              ].map((benefit) => (
                <p key={benefit} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-[#2f6f5e]" />
                  {benefit}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Coach Dashboard
            </p>
            <p className="mt-4 text-4xl font-semibold text-slate-950">$5 per month</p>
            <p className="mt-4 leading-7 text-slate-700">
              Founding coach pricing is available during the first launch phase.
            </p>
            <Link
              href="/coach/register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Create Coach Account
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Ready to find your next coach?
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Browse local private coaches and request training when you find the right fit.
          </p>
          <Link
            href="/coaches"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            Find Coaches
          </Link>
        </div>
      </section>
    </main>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#2f6f5e]">Step {number}</p>
      <h3 className="mt-3 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-700">{body}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-slate-700 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 leading-7">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
      >
        {label}
      </Link>
    </div>
  );
}
