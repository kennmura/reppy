import Link from "next/link";
import { Search } from "lucide-react";
import { CoachCard } from "@/components/CoachCard";
import { getPublishedCoaches } from "@/lib/data";
import { sports } from "@/lib/sports";

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; location?: string; training_type?: string }>;
}) {
  const coaches = await getPublishedCoaches();
  const params = await searchParams;

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Coach Directory
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Find local sports coaching
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-700">
              Starting with private soccer training in Greater Boston, built to grow into a broader
              local coach directory.
            </p>
          </div>
          <Link
            href="/coach-register"
            className="inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] sm:w-fit"
          >
            Get on the coaching radar
          </Link>
        </div>
        <form
          action="/coaches"
          className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <label className="text-sm font-medium text-slate-700">
            Sport
            <select
              name="sport"
              defaultValue={params.sport ?? ""}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
            >
              <option value="">All sports</option>
              {sports.map((sport) => (
                <option key={sport} value={sport.toLowerCase().replaceAll(" ", "-")}>
                  {sport}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Location
            <input
              name="location"
              defaultValue={params.location ?? ""}
              placeholder="City, town, or ZIP code"
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Training type
            <select
              name="training_type"
              defaultValue={params.training_type ?? ""}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
            >
              <option value="">All training</option>
              <option value="private">Private training</option>
              <option value="small-group">Small group</option>
              <option value="college-guidance">College guidance</option>
            </select>
          </label>
          <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] md:self-end">
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {coaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      </div>
    </main>
  );
}
