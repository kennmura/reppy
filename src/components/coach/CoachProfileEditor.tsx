import Link from "next/link";
import { saveCoachProfile } from "@/lib/actions";
import { sports } from "@/lib/sports";
import type { CoachAudience, CoachCredential, CoachProfileData, CoachService } from "@/lib/types";

type EditorMessage = {
  type: "success" | "error";
  text: string;
} | null;

export function CoachProfileEditor({
  profile,
  displayName,
  returnTo,
  message,
  submitLabel = "Submit for review",
}: {
  profile: CoachProfileData | null;
  displayName: string;
  returnTo: string;
  message?: EditorMessage;
  submitLabel?: string;
}) {
  const coach = profile?.coach;
  const services = fillRows<CoachService>(profile?.services ?? [], 4, (index) => ({
    id: `blank-service-${index}`,
    coach_id: coach?.id ?? "",
    title: "",
    description: "",
    duration: "",
    price: "",
    format: "",
    level: "",
    sort_order: index + 1,
    created_at: "",
  }));
  const credentials = fillRows<CoachCredential>(profile?.credentials ?? [], 4, (index) => ({
    id: `blank-credential-${index}`,
    coach_id: coach?.id ?? "",
    title: "",
    organization: "",
    description: "",
    year: null,
    sort_order: index + 1,
    is_verified: false,
    created_at: "",
    updated_at: "",
  }));
  const audiences = fillRows<CoachAudience>(profile?.audiences ?? [], 5, (index) => ({
    id: `blank-audience-${index}`,
    coach_id: coach?.id ?? "",
    label: "",
    sort_order: index + 1,
    created_at: "",
  }));
  const completion = coach?.profile_completion ?? 0;

  return (
    <form action={saveCoachProfile} className="grid gap-6">
      <input type="hidden" name="return_to" value={returnTo} />
      {message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">
              Coach profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Build your Reppy profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Add photos, a clear bio, session options, and credentials. Public text is scanned for
              direct contact details before review.
            </p>
          </div>
          <div className="min-w-36 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-950">{completion}% complete</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-[#2f6f5e]" style={{ width: `${completion}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Status: {coach?.profile_status?.replaceAll("_", " ") ?? "draft"}
            </p>
          </div>
        </div>
      </section>

      <EditorSection title="Basics">
        <Field label="Full name" name="full_name" defaultValue={coach?.full_name ?? displayName} required />
        <Field label="Profile slug" name="slug" defaultValue={coach?.slug ?? slugPreview(displayName)} required />
        <SportField defaultValue={coach?.sport ?? ""} />
        <Field label="Training category" name="category" defaultValue={coach?.category ?? ""} placeholder="Soccer technical training" />
        <Field label="Headline" name="headline" defaultValue={coach?.headline ?? ""} wide required />
        <Field
          label="Location or ZIP code"
          name="location"
          defaultValue={coach?.location ?? ""}
          placeholder="Waltham, MA or 02453"
          required
        />
        <Field label="City" name="city" defaultValue={coach?.city ?? ""} />
        <Field label="State" name="state" defaultValue={coach?.state ?? ""} placeholder="MA" />
        <Field label="ZIP code" name="zip_code" defaultValue={coach?.zip_code ?? ""} />
        <Field
          label="Service radius in miles"
          name="service_radius_miles"
          defaultValue={(coach?.service_radius_miles ?? 30).toString()}
          placeholder="30"
        />
        <Field label="Service area" name="service_area" defaultValue={coach?.service_area ?? ""} wide textarea rows={3} />
        <Field label="Pricing text" name="pricing_text" defaultValue={coach?.pricing_text ?? ""} wide />
      </EditorSection>

      <EditorSection title="Photos and links">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:col-span-2">
          Use JPG, PNG, or WebP under 5MB. Public profile text should not include phone numbers,
          emails, social handles, or direct booking instructions.
        </div>
        <FileField label="Profile photo" name="profile_photo_file" />
        <FileField label="Cover photo" name="banner_image_file" />
        <Field label="Profile photo URL fallback" name="profile_photo_url" defaultValue={coach?.profile_photo_url ?? ""} />
        <Field label="Cover photo URL fallback" name="banner_image_url" defaultValue={coach?.banner_image_url ?? ""} />
        <Field label="Instagram URL" name="instagram_url" defaultValue={coach?.instagram_url ?? ""} />
        <Field label="Video URL" name="video_url" defaultValue={coach?.video_url ?? ""} />
        <Field label="Booking URL" name="booking_url" defaultValue={coach?.booking_url ?? ""} wide />
      </EditorSection>

      <EditorSection title="Bio and coaching details">
        <Field label="Bio" name="bio" defaultValue={coach?.bio ?? ""} wide textarea rows={8} required />
        <Field label="Current affiliation" name="current_affiliation" defaultValue={coach?.current_affiliation ?? ""} />
        <Field label="Years of experience" name="years_experience" defaultValue={coach?.years_experience?.toString() ?? ""} />
        <Field label="Playing experience" name="playing_experience" defaultValue={coach?.playing_experience ?? ""} wide textarea rows={4} />
        <Field label="Coaching experience" name="coaching_experience" defaultValue={coach?.coaching_experience ?? ""} wide textarea rows={4} />
        <Field label="Training approach" name="training_approach" defaultValue={coach?.training_approach ?? ""} wide textarea rows={4} />
        <Field label="Age groups" name="age_groups" defaultValue={coach?.age_groups ?? ""} placeholder="Middle school, high school, college prep" />
        <Field label="Skill levels" name="skill_levels" defaultValue={coach?.skill_levels ?? ""} placeholder="Beginner, club, varsity" />
        <Field label="Positions or specialties" name="positions" defaultValue={coach?.positions ?? ""} placeholder="Goalkeepers, forwards, fullbacks" />
        <Field label="Training format" name="training_format" defaultValue={coach?.training_format ?? ""} placeholder="1-on-1, small group, clinics" />
        <Field label="General availability" name="general_availability" defaultValue={coach?.general_availability ?? ""} wide />
      </EditorSection>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Best-fit players</h2>
        <p className="mt-1 text-sm text-slate-600">Short labels shown in the profile sidebar.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {audiences.map((audience, index) => (
            <Field
              key={audience.id}
              label={`Audience ${index + 1}`}
              name="audience_label"
              defaultValue={audience.label}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Sessions and services</h2>
        <p className="mt-1 text-sm text-slate-600">Empty rows are ignored. The first service is highlighted.</p>
        <div className="mt-5 grid gap-4">
          {services.map((service, index) => (
            <ServiceRow key={service.id} service={service} index={index} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Credentials</h2>
        <p className="mt-1 text-sm text-slate-600">Licenses, teams, certifications, awards, or playing milestones.</p>
        <div className="mt-5 grid gap-4">
          {credentials.map((credential, index) => (
            <CredentialRow key={credential.id} credential={credential} index={index} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            name="accepting_requests"
            type="checkbox"
            defaultChecked={coach?.accepting_requests ?? true}
            className="mt-1"
          />
          <span>
            I am accepting training requests when this profile is approved. Reppy will keep parent
            and player conversations inside the Message Center.
          </span>
        </label>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            name="intent"
            value="draft"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
          >
            Save draft
          </button>
          <button
            name="intent"
            value="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            {submitLabel}
          </button>
          {coach ? (
            <Link
              href="/coach/profile/preview"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500"
            >
              Preview
            </Link>
          ) : null}
        </div>
      </section>
    </form>
  );
}

function fillRows<T>(rows: T[], minRows: number, blank: (index: number) => T) {
  const filled = [...rows];
  while (filled.length < minRows) {
    filled.push(blank(filled.length));
  }
  return filled;
}

function slugPreview(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SportField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      Sport
      <select
        name="sport"
        required
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      >
        <option value="">Select a sport</option>
        {sports.map((sport) => (
          <option key={sport} value={sport}>
            {sport}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileField({ label, name }: { label: string; name: string }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <input
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#12355b] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      />
    </label>
  );
}

function ServiceRow({ service, index }: { service: CoachService; index: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">Service {index + 1}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="service_title" defaultValue={service.title} />
        <Field label="Duration" name="service_duration" defaultValue={service.duration ?? ""} />
        <Field label="Price" name="service_price" defaultValue={service.price ?? ""} />
        <Field label="Format" name="service_format" defaultValue={service.format ?? ""} />
        <Field label="Level" name="service_level" defaultValue={service.level ?? ""} />
        <Field
          label="Description"
          name="service_description"
          defaultValue={service.description ?? ""}
          wide
          textarea
          rows={3}
        />
      </div>
    </div>
  );
}

function CredentialRow({ credential, index }: { credential: CoachCredential; index: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">Credential {index + 1}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="credential_title" defaultValue={credential.title} />
        <Field label="Organization" name="credential_organization" defaultValue={credential.organization ?? ""} />
        <Field label="Year" name="credential_year" defaultValue={credential.year?.toString() ?? ""} />
        <Field
          label="Description"
          name="credential_description"
          defaultValue={credential.description ?? ""}
          wide
          textarea
          rows={3}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  wide = false,
  textarea = false,
  rows = 4,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
  textarea?: boolean;
  rows?: number;
}) {
  const className =
    "mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15";

  return (
    <label className={`text-sm font-medium text-slate-800 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {textarea ? (
        <textarea
          name={name}
          required={required}
          defaultValue={defaultValue}
          rows={rows}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={className}
        />
      )}
    </label>
  );
}
