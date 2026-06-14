const terms = [
  "Reppy helps parents and players discover local coaches and send training requests through the platform. Parents and players are not charged to browse coaches or request training.",
  "Coaches are responsible for accurate profile content, safe communication, appropriate training locations, and complying with applicable laws, school, league, and facility requirements.",
  "Training requests, replies, and ordinary conversation activity should stay inside Reppy. Normal conversation messages are not sent by email.",
  "Browser push notifications may be used when a user grants permission. Push payloads should use generic text and should not include private message content or contact details.",
  "Free coaches may receive one limited email alert about a new locked training request. Premium and trial coaches should use in-app and push notifications for normal Message Center activity.",
  "Unsaved conversations expire 90 days after their most recent activity. Saved, reported, or legally held conversations may remain longer. Player records are managed separately from conversation retention.",
  "Contact information remains hidden unless a parent, guardian, or player explicitly chooses to share it inside a conversation.",
  "The platform may suspend accounts, remove content, revoke access, retain reported content, and review conversations for moderation, fraud prevention, safety, and legal reasons.",
  "For athletes under 18, a parent or guardian should be involved in training communication and scheduling.",
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
        <div className="mt-8 space-y-4">
          {terms.map((term) => (
            <p key={term}>{term}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
