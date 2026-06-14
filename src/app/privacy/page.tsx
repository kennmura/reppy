const sections = [
  {
    title: "Information we collect",
    body: "Reppy may collect account information, coach profile information, training request details, conversation messages, notification preferences, push subscription records, and moderation records needed to operate the platform.",
  },
  {
    title: "Authentication",
    body: "Authentication emails, account confirmation, password recovery, and sign-in links are handled through the authentication provider. Reppy does not use its custom alert email provider for standard authentication emails.",
  },
  {
    title: "Private account details",
    body: "Player date of birth, parent or guardian details, phone verification details, and account-type details are treated as private account data. These fields are used for account setup, request autofill, minor-safety workflows, support, and legal or fraud-prevention needs. They are not intended to be publicly readable.",
  },
  {
    title: "Payments and payouts",
    body: "Stripe processes card payments, subscriptions, billing portal sessions, Connect onboarding, payout eligibility, and bank or tax details. Reppy stores payment status, amounts, platform-fee records, payout amounts, masked or truncated Stripe identifiers for support, and safe Stripe metadata. Reppy should not store full card numbers, bank-account numbers, or Stripe secret keys.",
  },
  {
    title: "Messages stay inside Reppy",
    body: "Training requests, coach replies, and parent or player replies are stored and viewed inside Reppy. Normal conversation activity is not delivered by email.",
  },
  {
    title: "Notifications",
    body: "Reppy uses in-app notifications, unread badges, Supabase Realtime updates, and browser push when permission is granted. Push notifications use generic text and do not include full private messages, contact details, exact addresses, or private account information.",
  },
  {
    title: "Free-coach email alert",
    body: "A free coach may receive one limited email alert when a new locked training request arrives. That email may include only safe metadata such as sport, age range, general area, and training type.",
  },
  {
    title: "Contact details",
    body: "Email addresses, phone numbers, exact locations, and guardian contact details remain hidden from coaches unless a parent, guardian, or player intentionally shares selected contact information inside a conversation.",
  },
  {
    title: "Retention",
    body: "Unsaved conversations expire 90 days after their most recent activity. Saved conversations, reported conversations, and conversations under legal or safety hold may remain longer. Player records, billing records, subscription records, and required moderation audit records are managed separately from conversation retention.",
  },
  {
    title: "Moderation and safety",
    body: "Administrators may review reported conversations for safety, spam prevention, account suspension, bans, legal holds, and other legitimate moderation needs. Administrative access should be logged for sensitive reviews.",
  },
  {
    title: "Parents and guardians",
    body: "For athletes under 18, a parent or guardian should be involved in all training communication and scheduling. Verified parent, player, and guardian account flows are required before public launch.",
  },
  {
    title: "Your choices",
    body: "Users may disable browser push permission in their browser or device settings. In-app notifications remain part of essential platform operation. Users may contact Reppy to request data review or deletion.",
  },
];

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
