import Link from "next/link";
import { CoachProfileEditor } from "@/components/coach/CoachProfileEditor";
import { getCoachUserOrRedirect } from "@/lib/auth";
import { getCoachProfileByOwner } from "@/lib/data";

export const dynamic = "force-dynamic";

const messages: Record<string, { type: "success" | "error"; text: string }> = {
  saved: { type: "success", text: "Draft saved." },
  submitted: { type: "success", text: "Profile submitted for review." },
  "missing-required": { type: "error", text: "Full name, slug, and sport are required." },
  "missing-location": { type: "error", text: "Enter your location or ZIP code before saving." },
  "slug-taken": { type: "error", text: "That profile slug is already taken." },
  "public-contact": {
    type: "error",
    text: "Remove public phone numbers, emails, social handles, or direct booking instructions before submitting.",
  },
};

export default async function CoachOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCoachUserOrRedirect();
  const coachProfile = await getCoachProfileByOwner(user.id);
  const messageKey = params.error ?? (params.submitted ? "submitted" : params.saved ? "saved" : "");

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold text-slate-950">
            Reppy Coach Onboarding
          </Link>
          <Link href="/coach/dashboard" className="text-sm font-semibold text-[#12355b]">
            Dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <CoachProfileEditor
          profile={coachProfile}
          displayName={profile.display_name || user.email || "Coach"}
          returnTo="/coach/onboarding"
          message={messages[messageKey] ?? null}
        />
      </div>
    </main>
  );
}
