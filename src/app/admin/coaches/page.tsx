import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";
import { getAdminCoaches } from "@/lib/data";

export default async function AdminCoachesPage() {
  await getAdminUserOrRedirect();
  const coaches = await getAdminCoaches();

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Coaches</h1>
        <p className="mt-2 text-slate-600">Scan profile status, visibility, and request readiness.</p>
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_0.9fr_0.8fr_0.8fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid">
            <span>Name</span>
            <span>Sport</span>
            <span>Location</span>
            <span>Status</span>
            <span>Published</span>
            <span>Completion</span>
            <span>Action</span>
          </div>
          {coaches.length ? (
            coaches.map((coach) => (
              <div
                key={coach.id}
                className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[1.2fr_0.8fr_1fr_0.9fr_0.8fr_0.8fr_auto] lg:items-center"
              >
                <div>
                  <h2 className="font-semibold text-slate-950">{coach.full_name}</h2>
                  <p className="mt-1 text-xs text-slate-500">/coaches/{coach.slug}</p>
                </div>
                <AdminValue label="Sport" value={coach.sport ?? "Not set"} />
                <AdminValue label="Location" value={coach.location ?? coach.zip_code ?? "Not set"} />
                <div>
                  <MobileLabel>Status</MobileLabel>
                  <Badge>{coach.profile_status?.replaceAll("_", " ") ?? "draft"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MobileLabel>Published</MobileLabel>
                  <Badge tone={coach.is_published ? "green" : "gray"}>
                    {coach.is_published ? "Published" : "Hidden"}
                  </Badge>
                  <Badge tone={coach.accepting_requests === false ? "gray" : "green"}>
                    {coach.accepting_requests === false ? "Closed" : "Accepting"}
                  </Badge>
                </div>
                <AdminValue label="Completion" value={`${coach.profile_completion ?? 0}%`} />
                <Link
                  href={`/admin/coaches/${coach.id}`}
                  className="inline-flex w-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
                >
                  Edit / View
                </Link>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm leading-6 text-slate-600">No coach profiles yet.</p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function AdminValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MobileLabel>{label}</MobileLabel>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:hidden">{children}</p>;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
        tone === "green"
          ? "border-[#d7e5dc] bg-[#f3f8f5] text-[#2f6f5e]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}
