import { AccountShell } from "@/components/account/AccountShell";
import { calculateAgeFromDateOfBirth } from "@/lib/accountProfile";
import { updateAccountProfile } from "@/lib/actions";
import { getAccountContextOrRedirect, getAccountPrivateDetails } from "@/lib/auth";
import { getUserCoachingPreference } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getAccountContextOrRedirect();
  const [notificationCount, privateDetails, preference] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getAccountPrivateDetails(user.id),
    getUserCoachingPreference(user.id),
  ]);
  const emailVerified = Boolean(user.email_confirmed_at || profile.email_verified_at);
  const phoneVerified = Boolean(privateDetails?.phone_verified_at || profile.phone_verified_at || user.phone_confirmed_at);
  const playerDateOfBirth = privateDetails?.player_date_of_birth ?? preference?.player_birth_date ?? "";
  const calculatedAge = calculateAgeFromDateOfBirth(playerDateOfBirth);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Account settings</h1>
        <p className="mt-2 text-slate-600">Manage the player profile used for coach requests.</p>
        {params.saved ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Settings saved.
          </p>
        ) : null}
        {params.error === "missing-name" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Enter the player&apos;s name.
          </p>
        ) : null}
        {params.error === "missing-guardian" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Enter the parent or guardian name.
          </p>
        ) : null}
        {params.error === "missing-player-profile" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Add the player date of birth and current club/team before requesting training.
          </p>
        ) : null}
        {params.error === "invalid-dob" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Enter a valid player date of birth. It cannot be in the future.
          </p>
        ) : null}
        {params.error === "profile-save-failed" ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            We could not save the player profile. Please try again.
          </p>
        ) : null}
        <form action={updateAccountProfile} className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Field label="Player name" name="player_name" defaultValue={preference?.player_name ?? profile.display_name} required />
          <Field
            label={profile.role === "adult_player" ? "Parent/guardian name optional" : "Parent/guardian name"}
            name="guardian_name"
            defaultValue={preference?.guardian_name ?? ""}
            required={profile.role === "parent"}
          />
          <div className="text-sm font-medium text-slate-800">
            <Field
              label="Player date of birth"
              name="player_date_of_birth"
              type="date"
              defaultValue={playerDateOfBirth}
              required
            />
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Used to calculate the player&apos;s age for training requests. This should be the athlete&apos;s date of birth, not the parent&apos;s.
            </p>
            {calculatedAge !== null ? (
              <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                Calculated player age: {calculatedAge}
              </p>
            ) : null}
          </div>
          <Field label="Current club/team" name="current_team" defaultValue={preference?.current_team ?? ""} required />
          <Field label="Preferred training location" name="location_text" defaultValue={preference?.location_text ?? ""} />
          <Field label="Skill level" name="skill_level" defaultValue={preference?.skill_level ?? ""} />
          <Field label="Player position" name="position" defaultValue={preference?.position ?? ""} />
          <Field label="Preferred days/times" name="preferred_days" defaultValue={preference?.preferred_days ?? ""} wide />
          <Field label="Goals" name="training_goals" defaultValue={preference?.training_goals ?? ""} textarea wide />
          <Field label="Emergency/contact notes" name="contact_notes" defaultValue={preference?.contact_notes ?? ""} textarea wide />
          <button className="w-fit rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
            Save profile
          </button>
        </form>
        <div className="mt-8 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <Status label="Email verified" active={emailVerified} />
          <Status label="Phone verified" active={phoneVerified} />
        </div>
        <div className="mt-5 text-sm text-slate-700">
          {phoneVerified ? (
            <p>Verified phone: {privateDetails?.phone_e164 ?? "Stored in Supabase Auth"}</p>
          ) : (
            <a href="/account/verify-phone" className="font-semibold text-[#12355b]">
              Verify your phone
            </a>
          )}
        </div>
      </section>
    </AccountShell>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  textarea = false,
  wide = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  wide?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className={`text-sm font-medium text-slate-800 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {required ? <span className="text-red-700"> *</span> : null}
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} rows={4} className={className} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} className={className} />
      )}
    </label>
  );
}

function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className={`mt-1 text-sm ${active ? "text-emerald-700" : "text-amber-700"}`}>
        {active ? "Verified" : "Verification required"}
      </p>
    </div>
  );
}
