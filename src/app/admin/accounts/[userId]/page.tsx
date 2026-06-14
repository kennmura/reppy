import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminPlayerAccountById } from "@/lib/data";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await getAdminUserOrRedirect();
  const { userId } = await params;
  const account = await getAdminPlayerAccountById(userId);

  if (!account) {
    notFound();
  }

  const { profile, privateDetails, preference, conversations, savedCoaches, authUser } = account;
  const emailVerified = Boolean(profile.email_verified_at || authUser?.email_confirmed_at);
  const phoneVerified = Boolean(privateDetails?.phone_verified_at || profile.phone_verified_at || authUser?.phone_confirmed_at);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Link href="/admin/accounts" className="text-sm font-semibold text-[#12355b]">
            Back to accounts
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {profile.display_name || "Player/parent account"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Read-only testing view. Admin can inspect setup state and dashboard data, but this page
            does not impersonate the user.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Profile">
            <Field label="User ID" value={profile.id} mono />
            <Field label="Role" value={profile.role.replace("_", " ")} capitalize />
            <Field label="Account status" value={profile.account_status} capitalize />
            <Field label="Created" value={formatDate(profile.created_at)} />
            <Field label="Updated" value={formatDate(profile.updated_at)} />
          </InfoCard>

          <InfoCard title="Auth">
            <Field label="Email" value={authUser?.email ?? "Not available"} />
            <Field label="Email verified" value={emailVerified ? "Yes" : "No"} />
            <Field label="Auth phone" value={authUser?.phone ?? "Not set"} />
            <Field label="Phone verified" value={phoneVerified ? "Yes" : "No"} />
            <Field label="Last sign in" value={formatDate(authUser?.last_sign_in_at)} />
          </InfoCard>

          <InfoCard title="Private account details">
            <Field label="Mobile phone" value={privateDetails?.phone_e164 ?? "Not set"} />
            <Field label="Account type" value={privateDetails?.account_type?.replace("_", " ") ?? "Not set"} capitalize />
            <Field label="OTP sends" value={(privateDetails?.otp_send_count ?? 0).toString()} />
            <Field label="OTP attempts" value={(privateDetails?.otp_verify_attempt_count ?? 0).toString()} />
            <Field label="Last OTP sent" value={formatDate(privateDetails?.otp_last_sent_at)} />
          </InfoCard>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Search preferences</h2>
          {preference ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Sport" value={preference.sport ?? "Not set"} />
              <Field label="Location" value={preference.location_text ?? "Not set"} />
              <Field label="Radius" value={preference.search_radius_miles ? `${preference.search_radius_miles} miles` : "Not set"} />
              <Field label="Age group" value={preference.age_group ?? "Not set"} />
              <Field label="Skill level" value={preference.skill_level ?? "Not set"} />
              <Field label="Position" value={preference.position ?? "Not set"} />
              <Field label="Training format" value={preference.training_format ?? "Not set"} />
              <Field label="Preferred days" value={preference.preferred_days ?? "Not set"} />
              <Field label="Training goals" value={preference.training_goals ?? "Not set"} />
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">No saved search preferences.</p>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Saved coaches</h2>
            {savedCoaches.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {savedCoaches.map((coach) => (
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
              <p className="mt-3 text-sm leading-6 text-slate-600">No saved coaches.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Training conversations</h2>
            {conversations.length ? (
              <div className="mt-4 divide-y divide-slate-200">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className="grid gap-1 py-3">
                    <p className="font-semibold text-slate-950">{conversation.sport || "Training request"}</p>
                    <p className="text-sm text-slate-600">
                      {[conversation.request_type || "Training", conversation.general_location || "Area not provided"]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      Status: {conversation.status} · Last message: {formatDate(conversation.last_message_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">No conversations yet.</p>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-medium text-slate-900 ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}
