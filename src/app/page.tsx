import Link from "next/link";
import { CheckCircle2, ClipboardList, ShieldCheck, Users } from "lucide-react";
import { CoachCard } from "@/components/CoachCard";
import { isMarketplaceVisible, isPassportEnabled } from "@/lib/featureFlags";
import { getPublishedCoaches } from "@/lib/data";

const passportPoints = [
  "Coach feedback that follows the athlete",
  "Clips, focus areas, and game reflections",
  "High school, club, and private training continuity",
  "Parent-safe visibility for minors",
];

const modules = [
  {
    icon: ClipboardList,
    title: "Development timeline",
    body: "Track team joins, clips, coach feedback, focus areas, reflections, and handoff summaries in one player record.",
  },
  {
    icon: Users,
    title: "Team rosters",
    body: "Coaches create soccer or basketball teams, invite players by email, and build records before the season starts.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled sharing",
    body: "Public profiles stay clean. Private feedback, DOB, emails, parent details, and exact location stay protected.",
  },
];

export default async function Home() {
  const marketplaceVisible = isMarketplaceVisible();
  const featuredCoaches = marketplaceVisible ? (await getPublishedCoaches()).slice(0, 4) : [];

  return (
    <main className="pb-16 sm:pb-0">
      <section className="bg-[#f7f8f3]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_0.95fr] md:items-center lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Reppy Passport
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              A player-first development profile.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Reppy Passport helps athletes carry coach feedback, clips, and development history across high school, club, and private training.
            </p>
            <div className="mt-8 grid gap-3 sm:flex">
              <Link
                href="/account/passport"
                className="inline-flex items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
              >
                Open Passport
              </Link>
              <Link
                href="/passport/join"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-slate-500"
              >
                Join a Team
              </Link>
              <Link
                href="/coach/passport"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-slate-500"
              >
                Coach Teams
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div
              role="img"
              aria-label="Youth athlete training with a coach"
              className="h-64 overflow-hidden rounded-md bg-[url('/images/soccer-training-hero.png')] bg-cover bg-center sm:h-80"
            />
            <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
                Season handoff
              </p>
              <p className="text-lg font-semibold text-slate-950">
                Help every coach understand the player before the season starts.
              </p>
              <p className="text-sm leading-6 text-slate-600">
                Players know what to work on. Parents see progress. Coaches understand the athlete faster.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-5">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {passportPoints.map((point) => (
            <div key={point} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CheckCircle2 className="h-4 w-4 text-[#2f6f5e]" />
              {point}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Built for soccer and basketball
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Connect the handoff between high school and club seasons.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
              <section key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <Icon className="h-6 w-6 text-[#12355b]" />
                <h3 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
              </section>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f3] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">How Passport starts</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step number="1" title="Coach creates a team" body="Add a soccer or basketball roster manually or paste a CSV with player and parent emails." />
            <Step number="2" title="Players claim their profile" body="Players or parents join by code, then fill profile details and sharing preferences." />
            <Step number="3" title="Development record grows" body="Clips, feedback, focus areas, reflections, and handoff summaries build across the season." />
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Private training marketplace
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Offseason training recommendations coming soon.
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              The private coaching marketplace remains available behind routes, but Reppy is focused first on Passport adoption with local teams.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Launch target</p>
            <p className="mt-4 text-4xl font-semibold text-slate-950">200 players</p>
            <p className="mt-4 leading-7 text-slate-700">The near-term target is 200 players and 6 teams across high school and club.</p>
            {marketplaceVisible ? (
              <Link href="/coaches" className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Find Coaches
              </Link>
            ) : (
              <Link href="/account/passport" className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                Build Passport
              </Link>
            )}
          </div>
        </div>
      </section>

      {marketplaceVisible ? (
        <section className="bg-[#f7f8f3] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
                  Featured Coaches
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  Private coaches
                </h2>
              </div>
              <Link href="/coaches" className="text-sm font-semibold text-[#12355b] hover:text-[#0d2948]">
                Find Coaches
              </Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {featuredCoaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!isPassportEnabled() ? (
        <section className="bg-white py-8">
          <div className="mx-auto max-w-3xl px-4 text-center text-sm text-amber-950 sm:px-6 lg:px-8">
            Passport routes are deployed, but `REPPY_PASSPORT_ENABLED` is currently off.
          </div>
        </section>
      ) : null}
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
