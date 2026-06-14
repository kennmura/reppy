import Link from "next/link";
import { Search } from "lucide-react";
import { CoachCard } from "@/components/CoachCard";
import { getPublishedCoaches } from "@/lib/data";
import { geocodeLocationInput } from "@/lib/location";
import { sports, sportFromSlug, sportToSlug } from "@/lib/sports";

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; location?: string; training_type?: string }>;
}) {
  const params = await searchParams;
  const selectedSport = sportFromSlug(params.sport);
  const selectedSportSlug = selectedSport ? sportToSlug(selectedSport) : "";
  const location = params.location?.trim() ?? "";
  const hasCoordinateOrigin = Boolean(location && geocodeLocationInput(location));
  const trainingType = params.training_type?.trim() ?? "";
  const hasFilters = Boolean(selectedSportSlug || location || params.training_type);
  const coaches = params.sport && !selectedSport
    ? []
    : await getPublishedCoaches({ sport: selectedSport, location, trainingType });

  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Coach Directory
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Find Coaches
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-700">
              {selectedSport
                ? `Search private ${selectedSport.toLowerCase()} coaches by location and training style.`
                : "Search private coaches by sport, location, and training style."}
            </p>
          </div>
          <Link
            href="/coach/register"
            className="inline-flex w-full items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] sm:w-fit"
          >
            Create Coach Account
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
              defaultValue={selectedSportSlug}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
            >
              <option value="">All sports</option>
              {sports.map((sport) => (
                <option key={sport} value={sportToSlug(sport)}>
                  {sport}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Location
            <input
              name="location"
              defaultValue={location}
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
          <div className="flex flex-col gap-2 text-sm leading-6 text-slate-600 md:col-span-4 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Enter your ZIP code or location to find coaches within 30 miles.
            </p>
            {hasFilters ? (
              <Link href="/coaches" className="font-semibold text-[#12355b] hover:text-[#0d2948]">
                Clear filters
              </Link>
            ) : null}
          </div>
        </form>
        {location && !hasCoordinateOrigin ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            We could not find that location. Try city, state, or ZIP code.
          </div>
        ) : null}
        {coaches.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-slate-700 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              No {selectedSport ?? "matching"} coaches yet
            </h2>
            <p className="mt-2 leading-7">
              Try clearing filters or choosing another sport. Coaches only appear in a sport search
              when their profile lists that sport.
            </p>
            <Link
              href="/coaches"
              className="mt-5 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Clear filters
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
