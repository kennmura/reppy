import { notFound } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { updateCoach, updateCoachApprovalStatus } from "@/lib/actions";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoachProfileById } from "@/lib/data";
import { sports } from "@/lib/sports";
import type { CoachService } from "@/lib/types";

export default async function AdminCoachEditPage({ params }: { params: Promise<{ id: string }> }) {
  await getAdminUserOrRedirect();
  const { id } = await params;
  const profile = await getAdminCoachProfileById(id);

  if (!profile) {
    notFound();
  }

  const { coach, services } = profile;
  const serviceRows = [...services];
  while (serviceRows.length < 6) {
    serviceRows.push({
      id: `blank-${serviceRows.length}`,
      coach_id: coach.id,
      title: "",
      description: "",
      duration: "",
      price: "",
      sort_order: serviceRows.length + 1,
      created_at: "",
    });
  }

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit coach profile
        </h1>
        <p className="mt-2 text-slate-600">
          Update the public profile, photos, bio, and services shown on the coach page.
        </p>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Review status</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Current status:{" "}
                <span className="font-semibold capitalize text-slate-950">
                  {coach.profile_status?.replaceAll("_", " ") ?? "draft"}
                </span>
              </p>
              {coach.submitted_at ? (
                <p className="mt-1 text-sm text-slate-600">
                  Submitted {new Date(coach.submitted_at).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            <form action={updateCoachApprovalStatus} className="grid gap-3">
              <input type="hidden" name="id" value={coach.id} />
              <label className="text-sm font-medium text-slate-800">
                Review notes
                <textarea
                  name="review_notes"
                  defaultValue={coach.review_notes ?? ""}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  name="decision"
                  value="approved"
                  className="rounded-md bg-[#12355b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0d2948]"
                >
                  Approve and publish
                </button>
                <button
                  name="decision"
                  value="changes_requested"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
                >
                  Request changes
                </button>
                <button
                  name="decision"
                  value="rejected"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-500"
                >
                  Reject
                </button>
                <button
                  name="decision"
                  value="suspended"
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:border-red-400"
                >
                  Suspend
                </button>
              </div>
            </form>
          </div>
        </section>
        <form
          action={updateCoach}
          className="mt-6 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="id" value={coach.id} />
          <section className="grid gap-5 sm:grid-cols-2">
            <SectionTitle title="Profile basics" />
            <Field label="Full name" name="full_name" defaultValue={coach.full_name} required />
            <Field label="Profile slug" name="slug" defaultValue={coach.slug} required />
            <Field label="Email" name="email" defaultValue={coach.email ?? ""} />
            <Field label="Phone" name="phone" defaultValue={coach.phone ?? ""} />
            <SportField defaultValue={coach.sport ?? ""} />
            <Field label="Category" name="category" defaultValue={coach.category ?? ""} />
            <Field label="Headline" name="headline" defaultValue={coach.headline ?? ""} wide />
            <Field label="Location" name="location" defaultValue={coach.location ?? ""} />
            <Field
              label="Service area"
              name="service_area"
              defaultValue={coach.service_area ?? ""}
              wide
              textarea
            />
            <Field label="Pricing text" name="pricing_text" defaultValue={coach.pricing_text ?? ""} wide />
            <Field
              label="Admin premium access until"
              name="admin_premium_access_until"
              defaultValue={coach.admin_premium_access_until ?? ""}
              placeholder="YYYY-MM-DDTHH:mm:ssZ"
              wide
            />
            <Field label="Bio" name="bio" defaultValue={coach.bio ?? ""} wide textarea rows={8} />
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <SectionTitle title="Photos and links" />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:col-span-2">
              <p className="font-semibold text-slate-950">Image upload guidance</p>
              <p className="mt-1">
                Cover image: 1600 x 600 or larger. Profile image: 600 x 600 or larger. Accepted
                formats: JPG, PNG, WebP. Images are stored in Supabase Storage under
                coach-media/{coach.id}/cover and coach-media/{coach.id}/profile.
              </p>
            </div>
            <FileField label="Upload profile/headshot image" name="profile_photo_file" />
            <FileField label="Upload cover/background image" name="banner_image_file" />
            <Field
              label="Profile photo URL fallback"
              name="profile_photo_url"
              defaultValue={coach.profile_photo_url ?? ""}
              placeholder="https://..."
            />
            <Field
              label="Cover image URL fallback"
              name="banner_image_url"
              defaultValue={coach.banner_image_url ?? ""}
              placeholder="https://..."
            />
            <Field
              label="Instagram URL"
              name="instagram_url"
              defaultValue={coach.instagram_url ?? ""}
              placeholder="https://..."
            />
            <Field
              label="Video URL"
              name="video_url"
              defaultValue={coach.video_url ?? ""}
              placeholder="https://..."
            />
            <Field
              label="Booking URL"
              name="booking_url"
              defaultValue={coach.booking_url ?? ""}
              placeholder="https://..."
              wide
            />
          </section>

          <section>
            <SectionTitle title="Sessions and services" compact />
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add or edit the training options shown on the public profile. Empty rows are ignored.
            </p>
            <div className="mt-5 grid gap-4">
              {serviceRows.map((service, index) => (
                <ServiceEditor key={service.id} service={service} index={index} />
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" name="is_published" defaultChecked={coach.is_published} />
              Published
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" name="is_featured" defaultChecked={coach.is_featured} />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                name="accepting_requests"
                defaultChecked={coach.accepting_requests ?? true}
              />
              Accepting requests
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                name="founding_price_locked"
                defaultChecked={Boolean(coach.founding_price_locked)}
              />
              Founding price locked
            </label>
          </div>
          {coach.contact_scan_status === "flagged" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              This profile was flagged for possible public contact details. Remove contact methods
              from public text before publishing.
            </p>
          ) : null}
          <button className="w-fit rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
            Save changes
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}

function SectionTitle({ title, compact = false }: { title: string; compact?: boolean }) {
  return (
    <div className={compact ? "" : "sm:col-span-2"}>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

function SportField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      Sport
      <select
        name="sport"
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

function ServiceEditor({ service, index }: { service: CoachService; index: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-950">Service {index + 1}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="service_title" defaultValue={service.title} />
        <Field label="Duration" name="service_duration" defaultValue={service.duration ?? ""} />
        <Field label="Price" name="service_price" defaultValue={service.price ?? ""} />
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
