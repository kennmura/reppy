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
        <p className="mt-8">
          Reppy helps parents and players discover local coaches and send training requests through
          the platform. Parents and players are not charged to browse coaches or request training.
        </p>
        <p className="mt-4">
          Coaches are responsible for accurate profile content, safe communication, and complying
          with applicable laws and training-location requirements.
        </p>
        <p className="mt-4">
          The platform may suspend accounts, remove content, revoke access, and review reported
          conversations for moderation and safety purposes.
        </p>
      </article>
    </main>
  );
}
