import Link from "next/link";
import { signOutCurrentUser } from "@/lib/actions";
import { getApplicationProfile } from "@/lib/auth";
import { createSupabaseServerClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase";
import { AuthMenu } from "./AuthMenu";

async function getSessionNav() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return null;
  }

  if (!hasSupabaseAdminConfig()) {
    return {
      role: "account",
      dashboardHref: "/account/dashboard",
      profileHref: "/account/settings",
    };
  }

  try {
    const profile = await getApplicationProfile(data.user.id);

    if (profile?.role === "coach") {
      return {
        role: profile.role,
        dashboardHref: "/coach/dashboard",
        profileHref: "/coach/profile",
      };
    }

    if (profile?.role === "admin") {
      return {
        role: profile.role,
        dashboardHref: "/admin",
        profileHref: "/admin/accounts",
      };
    }
  } catch (error) {
    console.error("[navbar] Could not load current account profile", {
      userId: data.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    role: "account",
    dashboardHref: "/account/dashboard",
    profileHref: "/account/settings",
  };
}

export async function Navbar() {
  const sessionNav = await getSessionNav();
  const showFindCoaches = sessionNav?.role !== "coach";
  const navLinkClass = "inline-flex h-10 items-center rounded-md px-2 text-sm font-medium hover:text-slate-950";
  const secondaryButtonClass =
    "inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-[#12355b]/20";
  const primaryButtonClass =
    "inline-flex h-10 items-center justify-center rounded-md bg-[#12355b] px-3 text-sm font-semibold text-white hover:bg-[#0d2948] focus:outline-none focus:ring-2 focus:ring-[#12355b]/30 sm:px-4";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#12355b] text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-950">Reppy</span>
        </Link>
        <div className="flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-700 sm:w-auto sm:justify-end sm:gap-4">
          <Link href="/" className={navLinkClass}>
            Home
          </Link>
          {showFindCoaches ? (
            <Link href="/coaches" className={primaryButtonClass}>
              Find Coaches
            </Link>
          ) : null}
          {sessionNav ? (
            <div className="flex items-center gap-2">
              <Link href={sessionNav.dashboardHref} className={secondaryButtonClass}>
                Dashboard
              </Link>
              <Link href={sessionNav.profileHref} className={secondaryButtonClass}>
                Profile
              </Link>
              <form action={signOutCurrentUser}>
                <button className={secondaryButtonClass}>
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <AuthMenu />
          )}
        </div>
      </nav>
    </header>
  );
}
