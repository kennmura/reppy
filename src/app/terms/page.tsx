const sections = [
  {
    title: "Platform use",
    body: "Reppy helps parents and players discover local coaches and send training requests through the platform. Parents and players are not charged to browse coaches or request training.",
  },
  {
    title: "Coach responsibilities",
    body: "Coaches are responsible for accurate profile content, safe communication, appropriate training locations, and complying with applicable laws, school, league, and facility requirements.",
  },
  {
    title: "Training requests and messaging",
    body: "Training requests, replies, and ordinary conversation activity should stay inside Reppy. Normal conversation messages are not sent by email. Contact information remains hidden unless a parent, guardian, or player explicitly chooses to share it inside a conversation.",
  },
  {
    title: "Payments and platform fee",
    body: "First sessions accepted by a coach require payment through Reppy before the request is confirmed. Reppy records a 5% platform fee on payments processed through Reppy. Future sessions may be paid through Reppy or directly to the coach if that option is available for the coach and request.",
  },
  {
    title: "Coach-direct payments",
    body: "When a parent or player chooses a coach-direct payment method, Reppy does not process that payment, does not collect a platform fee on that payment, and cannot confirm that cash, check, or other direct payment was completed except when the coach marks it received in Reppy.",
  },
  {
    title: "Refunds, cancellations, and no-shows",
    body: "Refund, cancellation, late-arrival, weather, facility, and no-show outcomes may depend on the coach, request history, payment status, and applicable law. This draft policy needs final legal and business review before public launch. Until then, Reppy support may review disputes and may issue refunds through Stripe when appropriate.",
  },
  {
    title: "Coach payouts",
    body: "Coach payouts for Reppy-processed payments are handled through Stripe Connect. Coaches should complete Stripe Express onboarding and should not enter bank or payout details directly into Reppy. Stripe controls payout eligibility, timing, identity checks, tax forms, and bank-account handling.",
  },
  {
    title: "Notifications",
    body: "Browser push notifications may be used when a user grants permission. Push payloads should use generic text and should not include private message content or contact details. Free coaches may receive one limited email alert about a new locked training request.",
  },
  {
    title: "Retention and moderation",
    body: "Unsaved conversations expire 90 days after their most recent activity. Saved, reported, or legally held conversations may remain longer. The platform may suspend accounts, remove content, revoke access, retain reported content, and review conversations for moderation, fraud prevention, safety, and legal reasons.",
  },
  {
    title: "Parents, guardians, and minors",
    body: "For athletes under 18, a parent or guardian should be involved in training communication and scheduling. Adults using Reppy are responsible for choosing safe public or supervised training locations and for following school, league, facility, and youth-safety requirements.",
  },
];

export default function TermsPage() {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <article className="mx-auto max-w-3xl px-4 leading-8 text-slate-700 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Terms</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Terms of Service
        </h1>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Draft for product development. This page should be reviewed by a qualified professional
          before public launch.
        </p>
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mt-8 text-2xl font-semibold text-slate-950">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
