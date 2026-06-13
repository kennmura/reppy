import { AdminLayout } from "@/components/AdminLayout";
import { getAdminUserOrRedirect } from "@/lib/auth";

export default async function AdminConversationsPage() {
  await getAdminUserOrRedirect();
  return (
    <AdminLayout>
      <Placeholder
        title="Admin conversations"
        body="Moderation access to private conversations should log administrator access and be used only for legitimate safety and support needs."
      />
    </AdminLayout>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-3 leading-7 text-slate-700">{body}</p>
    </div>
  );
}
