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
        <p className="mt-2 text-slate-600">Edit public coach profile content and visibility.</p>
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {coaches.map((coach) => (
            <div key={coach.id} className="flex flex-col gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">{coach.full_name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  /coaches/{coach.slug} · {coach.is_published ? "Published" : "Unpublished"}
                </p>
              </div>
              <Link href={`/admin/coaches/${coach.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">
                Edit
              </Link>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
