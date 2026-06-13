import Link from "next/link";
import { CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { sports } from "@/lib/sports";

const browseSports = [
  "Soccer",
  "Basketball",
  "Baseball",
  "Tennis",
  "Golf",
  "Strength & Conditioning",
];

export default async function Home() {
  return (
    <main>
      <section className="bg-[#f7f8f3]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_0.95fr] md:items-center lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Local Sports Coaching
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Find the Right Coach. Improve Your Game.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Discover local coaches offering private and small-group training across the Northeast.
            </p>
            <div className="mt-8 grid gap-3 sm:flex">
              <Link
                href="/coaches"
                className="inline-flex items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
              >
                Browse Coaches
              </Link>
              <Link
                href="#for-coaches"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-slate-500"
              >
                Create a Coaching Profile
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div
              role="img"
              aria-label="Local sports coach training a youth athlete"
              className="h-64 overflow-hidden rounded-md bg-[url('/images/soccer-training-hero.png')] bg-cover bg-center sm:h-80"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-950">Coach profiles</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Background, training services, service areas, pricing notes, and profile photos.
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-[#f7f8f3] p-4">
                <p className="text-sm font-semibold text-slate-950">Built for local discovery</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Parents browse for free and send requests into each coach&apos;s Message Centre.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <form
            action="/coaches"
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <label className="text-sm font-medium text-slate-800">
              Sport
              <select
                name="sport"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
              >
                <option value="">Any sport</option>
                {sports.map((sport) => (
                  <option key={sport} value={sport.toLowerCase().replaceAll(" ", "-")}>
                    {sport}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-800">
              Location
              <input
                name="location"
                placeholder="City, town, or ZIP code"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
              />
            </label>
            <label className="text-sm font-medium text-slate-800">
              Training type
              <select
                name="training_type"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
              >
                <option value="">Any training</option>
                <option value="private">Private training</option>
                <option value="small-group">Small group</option>
                <option value="college-guidance">College guidance</option>
              </select>
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] md:self-end">
              <Search className="h-4 w-4" />
              Search Coaches
            </button>
          </form>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Browse by Sport</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {browseSports.map((sport) => (
              <Link
                key={sport}
                href={`/coaches?sport=${encodeURIComponent(sport.toLowerCase().replaceAll(" ", "-"))}`}
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
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">How It Works</h2>
          <p className="mt-3 max-w-2xl text-slate-700">
            Browsing coaches and requesting training are free for parents and players.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step number="1" title="Explore Local Coaches" body="Browse coaches by sport, location, experience, and training style." />
            <Step number="2" title="Review Their Profile" body="Learn about their background, services, location, and approach to training." />
            <Step number="3" title="Request Training" body="Send the coach a training request directly through their profile." />
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <ShieldCheck className="h-8 w-8 text-[#2f6f5e]" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Designed for Clear, Safe Communication
            </h2>
          </div>
          <p className="text-lg leading-8 text-slate-700">
            Coach profiles explain training services, experience, service areas, and request
            options. For athletes under 18, a parent or guardian should be involved in all training
            communication and scheduling.
          </p>
        </div>
      </section>

      <section id="for-coaches" className="bg-[#f7f8f3] py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_0.8fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              For Coaches
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Grow Your Private Coaching Business
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              Create a professional public profile, showcase your training services, and get
              discovered by local parents and players.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Professional public coach profile",
                "Personal profile URL",
                "Service and pricing information",
                "Headshot and cover photo",
                "Message Centre training requests",
                "Visibility in the public coach directory",
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
              Founding Coach Plan
            </p>
            <p className="mt-4 text-4xl font-semibold text-slate-950">$5 per month</p>
            <p className="mt-4 leading-7 text-slate-700">
              Available to the first five coaches during the initial launch.
            </p>
            <Link
              href="/coach-register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Create Your Profile
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
            Ready to Start Training?
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Explore local coaches and find the right fit for your goals.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:justify-center">
            <Link
              href="/coaches"
              className="inline-flex items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Browse Coaches
            </Link>
            <Link
              href="/coach-register"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:border-slate-500"
            >
              Join as a Coach
            </Link>
          </div>
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
