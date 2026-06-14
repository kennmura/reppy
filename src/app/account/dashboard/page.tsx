import Link from "next/link";
import { AccountShell } from "@/components/account/AccountShell";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { accountRequestProfileFrom, isAccountRequestProfileComplete } from "@/lib/accountProfile";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { getAccountConversations, getSavedCoachesForUser, getUserCoachingPreference } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountDashboardPage() {
  const { user, profile } = await getAccountContextOrRedirect();
  const [notificationCount, conversations, preference] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountConversations(user.id),
    getUserCoachingPreference(user.id),
  ]);
  const savedCoaches = await getSavedCoachesForUser(user.id);
  const unreadMessages = conversations.reduce(
    (total, conversation) => total + Number(conversation.participant_unread_count ?? 0),
    0,
  );
  const requestProfile = accountRequestProfileFrom({ profile, preference });
  const profileComplete = isAccountRequestProfileComplete(requestProfile);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <RealtimeRefresh userId={user.id} />
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
            Player/Parent Account
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Welcome, {profile.display_name}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-700">
            Find coaches, send training requests, and continue conversations from one dashboard.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/coaches"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Find Coaches
            </Link>
            <Link
              href="/account/preferences"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Update preferences
            </Link>
          </div>
        </section>

        {!profileComplete ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-lg font-semibold">Complete your player profile</h2>
            <p className="mt-2 text-sm leading-6">
              Add player name, parent/guardian name, player age, and current club/team once so
              Reppy can use it automatically for training requests.
            </p>
            <Link
              href="/account/settings?error=missing-player-profile"
              className="mt-4 inline-flex rounded-md bg-[#12355b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Complete profile
            </Link>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Training requests" value={conversations.length} />
          <Metric label="Unread messages" value={unreadMessages} />
          <Metric label="Saved coaches" value={savedCoaches.length} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Recent training requests</h2>
            {conversations.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {conversations.slice(0, 4).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/account/messages/${conversation.id}`}
                    className="grid gap-1 py-3 hover:text-[#12355b]"
                  >
                    <span className="font-semibold text-slate-950">
                      {conversation.sport || "Training request"}
                    </span>
                    <span className="text-sm text-slate-600">
                      {conversation.request_type || "Training"} -{" "}
                      {conversation.general_location || "Area not provided"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                text="You have not sent any training requests yet. Find a coach to get started."
                href="/coaches"
                label="Find Coaches"
              />
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Recent messages</h2>
            {conversations.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {conversations.slice(0, 4).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/account/messages/${conversation.id}`}
                    className="grid gap-1 py-3 hover:text-[#12355b]"
                  >
                    <span className="font-semibold text-slate-950">
                      {conversation.participant_unread_count ? "Unread message" : "Conversation"}
                    </span>
                    <span className="text-sm text-slate-600">
                      {conversation.sport || "Training"} -{" "}
                      {conversation.general_location || "Area not provided"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                text="Your conversations will appear here after you request training."
                href="/coaches"
                label="Find Coaches"
              />
            )}
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Saved coaches</h2>
          {savedCoaches.length ? (
            <div className="mt-4 divide-y divide-slate-200">
              {savedCoaches.slice(0, 5).map((coach) => (
                <Link
                  key={coach.id}
                  href={`/coaches/${coach.slug}`}
                  className="grid gap-1 py-3 hover:text-[#12355b]"
                >
                  <span className="font-semibold text-slate-950">{coach.full_name}</span>
                  <span className="text-sm text-slate-600">
                    {[coach.sport, coach.public_location || coach.location].filter(Boolean).join(" - ")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              text="Save coaches from their profiles to compare options before you request training."
              href="/coaches"
              label="Find Coaches"
            />
          )}
        </section>

        {!preference?.sport && !preference?.location_text ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Personalize your coach search</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add your sport, location, age group, and goals so your dashboard reflects what you are
              looking for.
            </p>
            <Link
              href="/account/preferences"
              className="mt-4 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Update preferences
            </Link>
          </section>
        ) : null}
      </div>
    </AccountShell>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
      <p>{text}</p>
      <Link href={href} className="mt-3 inline-flex font-semibold text-[#12355b] hover:text-[#0d2948]">
        {label}
      </Link>
    </div>
  );
}
