import Link from "next/link";
import { signOutAdmin } from "@/lib/actions";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="text-lg font-semibold text-slate-950">
            Reppy Admin
          </Link>
          <form action={signOutAdmin}>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-500">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[180px_1fr] lg:px-8">
        <aside className="flex flex-wrap gap-2 md:flex-col">
          <Link href="/admin" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Dashboard
          </Link>
          <Link href="/admin/requests" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Requests
          </Link>
          <Link href="/admin/coaches" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Coaches
          </Link>
          <Link href="/admin/accounts" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Accounts
          </Link>
          <Link href="/admin/passport" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Passport
          </Link>
          <Link href="/admin/coach-applications" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Applications
          </Link>
          <Link href="/admin/conversations" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Conversations
          </Link>
          <Link href="/admin/reports" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Reports
          </Link>
          <Link href="/admin/reviews" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Reviews
          </Link>
          <Link href="/admin/bans" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Bans
          </Link>
          <Link href="/admin/subscriptions" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Subscriptions
          </Link>
          <Link href="/admin/coach-promo" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Coach Promo
          </Link>
          <Link href="/admin/referrals" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
            Referrals
          </Link>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
