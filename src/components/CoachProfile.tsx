import Link from "next/link";
import { Award, Bookmark, Camera, MessageSquare, Star } from "lucide-react";
import { LocationSection } from "./LocationSection";
import { PricingSection } from "./PricingSection";
import { RequestTrainingForm } from "./RequestTrainingForm";
import { ServiceCard } from "./ServiceCard";
import { toggleSavedCoach } from "@/lib/actions";
import { getRequestingAccountState } from "@/lib/auth";
import { getSavedCoachIdsForUser } from "@/lib/data";
import type { Coach, CoachProfileData } from "@/lib/types";

export async function CoachProfile({ profile }: { profile: CoachProfileData }) {
  const { coach, services, audiences, testimonials, credentials = [] } = profile;
  const accountState = await getRequestingAccountState();
  const savedCoachIds =
    accountState.status === "verified" ? await getSavedCoachIdsForUser(accountState.user.id, [coach.id]) : [];
  const isSaved = savedCoachIds.includes(coach.id);
  const requestCtaLabel = coach.accepting_requests === false ? "Not accepting requests" : "Request Training";

  return (
    <>
      <SocialProfileHeader coach={coach} requestCtaLabel={requestCtaLabel} isSaved={isSaved} />
      <section className="bg-[#f7f8f3] py-8 sm:py-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Quick facts</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6">
                <QuickFact label="Sport" value={coach.sport ?? coach.category ?? "Not listed"} />
                <QuickFact label="Location" value={coachLocationLabel(coach) ?? "Available after request"} />
                <QuickFact label="Training format" value={coach.training_format ?? "Private and small-group"} />
                <QuickFact label="Age groups" value={coach.age_groups ?? "Ask coach"} />
                <QuickFact label="Price/session" value={coach.pricing_text ?? "Contact for pricing"} />
                <QuickFact
                  label="Experience"
                  value={
                    coach.years_experience
                      ? `${coach.years_experience} years`
                      : coach.current_affiliation || "Profile reviewed by Reppy"
                  }
                />
                {coach.general_availability ? (
                  <QuickFact label="Availability" value={coach.general_availability} />
                ) : null}
                <QuickFact
                  label="Status"
                  value={coach.accepting_requests === false ? "Not currently accepting requests" : "Accepting requests"}
                />
              </div>
            </section>
            {audiences.length || coach.age_groups || coach.skill_levels || coach.positions ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Best for</h2>
                <div className="mt-4 grid gap-2">
                  {coach.age_groups ? <ProfileTag label={coach.age_groups} /> : null}
                  {coach.skill_levels ? <ProfileTag label={coach.skill_levels} /> : null}
                  {coach.positions ? <ProfileTag label={coach.positions} /> : null}
                  {audiences.map((audience) => (
                    <ProfileTag key={audience.id} label={audience.label} />
                  ))}
                </div>
              </section>
            ) : null}
            {credentials.length ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">Credentials</h2>
                <div className="mt-4 space-y-4">
                  {credentials.map((credential) => (
                    <div key={credential.id} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <Award className="mt-0.5 h-5 w-5 flex-none text-[#2f6f5e]" />
                      <div>
                        <p className="font-semibold text-slate-950">{credential.title}</p>
                        <p>
                          {[credential.organization, credential.year].filter(Boolean).join(" - ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
          <div className="space-y-4">
            <section id="about" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <Avatar coach={coach} size="small" />
                <div>
                  <h2 className="font-semibold text-slate-950">About</h2>
                  <p className="text-sm text-slate-600">{coach.full_name}</p>
                </div>
              </div>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-700">
                {coach.bio?.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {coach.training_approach || coach.playing_experience || coach.coaching_experience ? (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {coach.training_approach ? (
                    <MiniInfo title="Training approach" body={coach.training_approach} />
                  ) : null}
                  {coach.playing_experience ? (
                    <MiniInfo title="Playing experience" body={coach.playing_experience} />
                  ) : null}
                  {coach.coaching_experience ? (
                    <MiniInfo title="Coaching experience" body={coach.coaching_experience} />
                  ) : null}
                </div>
              ) : null}
            </section>
            <section id="sessions" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
                    Sessions
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    Training services
                  </h2>
                </div>
                <Link
                  href="#request-training"
                  className="hidden rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948] sm:inline-flex"
                >
                  Request
                </Link>
              </div>
              <div className="mt-5 grid gap-4">
                {services.length ? (
                  services.map((service) => <ServiceCard key={service.id} service={service} />)
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    Services will appear here after the coach adds session details.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
      <LocationSection coach={coach} />
      <PricingSection coach={coach} />
      {testimonials.length ? (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Testimonials</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {testimonials.map((testimonial) => (
                <blockquote key={testimonial.id} className="rounded-lg border border-slate-200 p-5">
                  <p className="leading-7 text-slate-700">&quot;{testimonial.quote}&quot;</p>
                  {testimonial.author ? (
                    <footer className="mt-4 text-sm font-semibold text-slate-950">
                      {testimonial.author}
                    </footer>
                  ) : null}
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section id="request-training" className="bg-[#f7f8f3] py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
              Request Training
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Request Training
            </h2>
            <p className="mt-4 leading-7 text-slate-700">
              Share the player&apos;s goals, current level, and general availability. Exact private
              locations are handled after the inquiry.
            </p>
            <p className="mt-4 rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm leading-6 text-slate-700">
              For athletes under 18, a parent or guardian should be involved in all training
              communication and scheduling.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <RequestTrainingGate coach={coach} accountState={accountState} />
          </div>
        </div>
      </section>
    </>
  );
}

function ProfileTag({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <Star className="h-4 w-4 flex-none text-[#2f6f5e]" />
      {label}
    </div>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function MiniInfo({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

function SocialProfileHeader({
  coach,
  requestCtaLabel,
  isSaved,
}: {
  coach: Coach;
  requestCtaLabel: string;
  isSaved: boolean;
}) {
  const coverImage = coach.banner_image_url || "/images/soccer-training-hero.png";
  const hasMessagingBadge =
    coach.subscription_status === "active" ||
    coach.subscription_status === "trialing" ||
    Boolean(coach.admin_premium_access_until);

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto w-[min(calc(100%-32px),1180px)] px-4 pt-4 sm:px-0">
        <div className="relative mb-[58px] sm:mb-[70px] lg:mb-[78px]">
          <div className="aspect-[4/3] max-h-[320px] min-h-[220px] overflow-hidden rounded-lg border border-slate-200 bg-[#e8ece7] sm:aspect-[16/7] sm:min-h-[240px] lg:aspect-[16/6] lg:max-h-[420px] lg:min-h-[260px]">
            <div
              role="img"
              aria-label={`${coach.full_name} cover photo`}
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${coverImage}")` }}
            />
          </div>
          <div className="absolute bottom-0 left-4 z-10 translate-y-1/2 sm:left-8">
            <Avatar coach={coach} />
          </div>
        </div>
        <div className="grid gap-5 border-b border-slate-200 pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[1.02] tracking-tight text-slate-950 text-balance">
              {coach.full_name}
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-700 sm:text-lg">
              {coach.headline}
            </p>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:gap-2">
              <span>{coach.sport ?? coach.category}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                -
              </span>
              <span>{coachLocationLabel(coach)}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                -
              </span>
              <span>{coach.accepting_requests === false ? "Not currently accepting requests" : "Accepting requests"}</span>
            </div>
            {hasMessagingBadge ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-2.5 py-1 text-xs font-semibold text-[#2f6f5e]">
                  Premium
                </span>
                <span className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-2.5 py-1 text-xs font-semibold text-[#2f6f5e]">
                  Messaging Active
                </span>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:flex">
            <form action={toggleSavedCoach}>
              <input type="hidden" name="coach_id" value={coach.id} />
              <input type="hidden" name="coach_slug" value={coach.slug} />
              <input type="hidden" name="saved" value={isSaved ? "1" : "0"} />
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500 sm:w-auto">
                <Bookmark className={`h-4 w-4 ${isSaved ? "fill-[#2f6f5e] text-[#2f6f5e]" : ""}`} />
                {isSaved ? "Saved" : "Save"}
              </button>
            </form>
            <Link
              href="#request-training"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              <MessageSquare className="h-4 w-4" />
              {requestCtaLabel}
            </Link>
            <Link
              href="#sessions"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
            >
              View Sessions
            </Link>
          </div>
        </div>
        <nav className="flex gap-6 overflow-x-auto py-3 text-sm font-semibold text-slate-600">
          <Link href="#about" className="whitespace-nowrap text-[#12355b]">
            About
          </Link>
          <Link href="#sessions" className="whitespace-nowrap hover:text-slate-950">
            Sessions
          </Link>
          <Link href="#request-training" className="whitespace-nowrap hover:text-slate-950">
            Request
          </Link>
        </nav>
      </div>
    </section>
  );
}

function coachLocationLabel(coach: Coach) {
  return coach.public_location || [coach.city, coach.state].filter(Boolean).join(", ") || coach.location;
}

function RequestTrainingGate({
  coach,
  accountState,
}: {
  coach: Coach;
  accountState: Awaited<ReturnType<typeof getRequestingAccountState>>;
}) {
  const intendedPath = `/coaches/${coach.slug}?requestTraining=1#request-training`;
  const encodedNext = encodeURIComponent(intendedPath);

  if (accountState.status === "verified") {
    return <RequestTrainingForm coachSlug={coach.slug} />;
  }

  if (accountState.status === "anonymous") {
    return (
      <div className="grid gap-4">
        <h3 className="text-xl font-semibold text-slate-950">Sign in to request training</h3>
        <p className="text-sm leading-6 text-slate-600">
          Please sign in or create a Player/Parent Account before sending a training request.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/account/register?next=${encodedNext}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            Create Player/Parent Account
          </Link>
          <Link
            href={`/account/login?next=${encodedNext}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (accountState.status === "email_unverified") {
    return (
      <VerificationPrompt
        title="Verify your email to request training."
        body="Open the confirmation link from Supabase before sending a request."
        href={`/account/verify-email?next=${encodedNext}`}
        label="Verify email"
      />
    );
  }

  if (accountState.status === "phone_unverified") {
    return (
      <VerificationPrompt
        title="Verify your phone to request training."
        body="Reppy requires a verified adult mobile number before training requests can be sent."
        href={`/account/verify-phone?next=${encodedNext}`}
        label="Verify phone"
      />
    );
  }

  if (accountState.status === "wrong_role") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Coach accounts cannot submit training requests from coach profiles.
      </div>
    );
  }

  return (
    <VerificationPrompt
      title="Account verification required"
      body="Finish account setup before sending a training request."
      href="/account/login"
      label="Account sign in"
    />
  );
}

function VerificationPrompt({
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
    <div className="grid gap-4">
      <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
      <p className="text-sm leading-6 text-slate-600">{body}</p>
      <Link
        href={href}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
      >
        {label}
      </Link>
    </div>
  );
}

function Avatar({ coach, size = "large" }: { coach: Coach; size?: "large" | "small" }) {
  const nameParts = coach.full_name.trim().split(/\s+/);
  const initials = `${nameParts[0]?.[0] ?? ""}${nameParts[nameParts.length - 1]?.[0] ?? ""}`;
  const sizeClass =
    size === "large"
      ? "h-[clamp(104px,13vw,168px)] w-[clamp(104px,13vw,168px)] rounded-full text-[clamp(2rem,4vw,3rem)]"
      : "h-11 w-11 rounded-full text-sm";

  if (coach.profile_photo_url) {
    return (
      <div
        role="img"
        aria-label={`${coach.full_name} profile photo`}
        className={`${sizeClass} flex-none overflow-hidden border-[5px] border-white bg-cover bg-center font-semibold text-white shadow-sm`}
        style={{ backgroundImage: `url("${coach.profile_photo_url}")` }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${coach.full_name} initials`}
      className={`${sizeClass} flex flex-none items-center justify-center overflow-hidden border-[5px] border-white bg-[#12355b] font-bold text-white shadow-sm`}
    >
      {size === "large" ? initials : <Camera className="h-5 w-5" />}
    </div>
  );
}
