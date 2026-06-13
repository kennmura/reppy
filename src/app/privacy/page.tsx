export default function PrivacyPage() {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <article className="mx-auto max-w-3xl px-4 leading-8 text-slate-700 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
          Privacy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Privacy Policy
        </h1>
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Draft for product development. This is not final legal advice and should be reviewed by a
          qualified professional before public launch.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Information we collect</h2>
        <p>
          Reppy may collect account information, coach profile information, training request
          information, and messages needed to operate the coaching platform.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Contact details</h2>
        <p>
          Contact details are hidden from coaches unless a parent, guardian, or player intentionally
          shares selected contact information inside a conversation.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Moderation</h2>
        <p>
          Administrators may review reported conversations for safety, spam prevention, account
          suspension, bans, and other legitimate moderation needs.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Retention</h2>
        <p>
          Unsaved conversations are eligible for message-content deletion after one year. Saved
          conversations may remain available until unsaved, deleted, or overridden by user deletion
          requests or safety requirements.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Parents and guardians</h2>
        <p>
          For athletes under 18, a parent or guardian should be involved in all training
          communication and scheduling. Verified parent/player accounts are a launch requirement.
        </p>
        <h2 className="mt-8 text-2xl font-semibold text-slate-950">Deletion requests</h2>
        <p>
          Users can contact the platform to request deletion or review of their data. Final support
          contact details should be added before launch.
        </p>
      </article>
    </main>
  );
}
