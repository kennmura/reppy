import Link from "next/link";
import { Camera, Dumbbell, MapPin, MessageSquare, ShieldCheck, Star } from "lucide-react";
import { LocationSection } from "./LocationSection";
import { PricingSection } from "./PricingSection";
import { RequestTrainingForm } from "./RequestTrainingForm";
import { ServiceCard } from "./ServiceCard";
import type { Coach, CoachProfileData } from "@/lib/types";

export function CoachProfile({ profile }: { profile: CoachProfileData }) {
  const { coach, services, audiences, testimonials } = profile;

  return (
    <>
      <SocialProfileHeader coach={coach} />
      <section className="bg-[#f7f8f3] py-8 sm:py-10">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Intro</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-[#2f6f5e]" />
                  Brandeis University Men&apos;s Soccer Student-Athlete
                </p>
                <p className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 flex-none text-[#2f6f5e]" />
                  {coach.location}
                </p>
                <p className="flex gap-3">
                  <Dumbbell className="mt-0.5 h-5 w-5 flex-none text-[#2f6f5e]" />
                  {coach.category ?? coach.sport}
                </p>
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Best for</h2>
              <div className="mt-4 grid gap-2">
                {audiences.map((audience) => (
                  <div key={audience.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <Star className="h-4 w-4 flex-none text-[#2f6f5e]" />
                    {audience.label}
                  </div>
                ))}
              </div>
            </section>
          </aside>
          <div className="space-y-4">
            <section id="about" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <Avatar coach={coach} size="small" />
                <div>
                  <h2 className="font-semibold text-slate-950">{coach.full_name}</h2>
                  <p className="text-sm text-slate-600">About this coach</p>
                </div>
              </div>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-700">
                {coach.bio?.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
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
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
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
              Tell me what you&apos;re working toward.
            </h2>
            <p className="mt-4 leading-7 text-slate-700">
              Share the player&apos;s goals, current level, and general availability. Exact training
              locations are handled after the inquiry.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <RequestTrainingForm coachSlug={coach.slug} />
          </div>
        </div>
      </section>
    </>
  );
}

function SocialProfileHeader({ coach }: { coach: Coach }) {
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
              <span>{coach.category ?? coach.sport}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span>{coach.location}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span>1-on-1 and small-group training</span>
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
            <Link
              href="#request-training"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              <MessageSquare className="h-4 w-4" />
              Request Training
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
