import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { signOutAccount } from "@/lib/actions";
import { isMarketplaceVisible } from "@/lib/featureFlags";

export function AccountShell({
  children,
  userId,
  notificationCount,
}: {
  children: React.ReactNode;
  userId: string;
  notificationCount: number;
}) {
  const links = [
    { href: "/account/dashboard", label: "Dashboard" },
    { href: "/account/passport", label: "Passport" },
    { href: "/account/players", label: "Manage athletes" },
    { href: "/passport/join", label: "Join team" },
    { href: "/account/messages", label: "Messages" },
    ...(isMarketplaceVisible() ? [{ href: "/coaches", label: "Find Coaches" }] : []),
    { href: "/account/preferences", label: "Preferences" },
    { href: "/account/settings", label: "Profile / Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/account/dashboard" className="text-lg font-semibold text-slate-950">
            Player/Parent Account
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} initialCount={notificationCount} href="/account/notifications" />
            <form action={signOutAccount}>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-500">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="flex flex-wrap gap-1 lg:grid">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex h-10 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
