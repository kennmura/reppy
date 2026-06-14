import { AccountShell } from "@/components/account/AccountShell";
import { saveAccountPreferences } from "@/lib/actions";
import { getAccountContextOrRedirect } from "@/lib/auth";
import { getUserCoachingPreference } from "@/lib/data";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const { user } = await getAccountContextOrRedirect();
  const [notificationCount, preference] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getUserCoachingPreference(user.id),
  ]);

  return (
    <AccountShell userId={user.id} notificationCount={notificationCount}>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coaching preferences</h1>
        <p className="mt-2 text-slate-600">
          Save what you are looking for so future coach search and requests start with the right context.
        </p>
        {params.saved ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Preferences saved.
          </p>
        ) : null}
        <form action={saveAccountPreferences} className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            Sport
            <select
              name="sport"
              defaultValue={preference?.sport ?? ""}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
            >
              <option value="">Any sport</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </label>
          <Field label="Location" name="location_text" defaultValue={preference?.location_text ?? ""} />
          <Field label="Search radius miles" name="search_radius_miles" defaultValue={preference?.search_radius_miles?.toString() ?? ""} />
          <Field label="Age group" name="age_group" defaultValue={preference?.age_group ?? ""} />
          <Field label="Skill level" name="skill_level" defaultValue={preference?.skill_level ?? ""} />
          <Field label="Position or focus" name="position" defaultValue={preference?.position ?? ""} />
          <Field label="Price min" name="price_min" defaultValue={preference?.price_min?.toString() ?? ""} />
          <Field label="Price max" name="price_max" defaultValue={preference?.price_max?.toString() ?? ""} />
          <Field label="Training format" name="training_format" defaultValue={preference?.training_format ?? ""} />
          <Field label="Preferred days" name="preferred_days" defaultValue={preference?.preferred_days ?? ""} />
          <Field
            label="Training goals"
            name="training_goals"
            defaultValue={preference?.training_goals ?? ""}
            wide
            textarea
          />
          <button className="w-fit rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948] sm:col-span-2">
            Save preferences
          </button>
        </form>
      </section>
    </AccountShell>
  );
}

function Field({
  label,
  name,
  defaultValue,
  wide = false,
  textarea = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  wide?: boolean;
  textarea?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className={`text-sm font-medium text-slate-800 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} rows={5} className={className} />
      ) : (
        <input name={name} defaultValue={defaultValue} className={className} />
      )}
    </label>
  );
}
