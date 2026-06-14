"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/coach/dashboard", label: "Dashboard" },
  { href: "/coach/calendar", label: "Calendar" },
  { href: "/coach/profile", label: "Profile" },
  { href: "/coach/messages", label: "Messages" },
  { href: "/coach/messages?status=unread", label: "Requests" },
  { href: "/coach/billing", label: "Billing / Subscription" },
  { href: "/coach/settings/notifications", label: "Settings" },
];

export function CoachSidebarNav({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  return (
    <nav className="flex flex-wrap gap-1 lg:grid">
      {links.map((link) => {
        const hrefPath = link.href.split("?")[0];
        const isRequests = link.href.includes("status=unread");
        const active = isRequests
          ? pathname === "/coach/messages" && status === "unread"
          : hrefPath === "/coach/messages"
            ? pathname.startsWith("/coach/messages/") || (pathname === "/coach/messages" && !status)
            : pathname === hrefPath;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center justify-between whitespace-nowrap rounded-md px-3 text-sm font-medium transition ${
              active
                ? "bg-[#12355b] text-white"
                : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span>{link.label}</span>
            {link.label === "Messages" && unreadCount ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                active ? "bg-white text-[#12355b]" : "bg-[#12355b] text-white"
              }`}>
                {unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
