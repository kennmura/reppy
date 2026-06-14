import Link from "next/link";

export function Navbar() {
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
          <Link href="/" className="hover:text-slate-950">
            Home
          </Link>
          <Link href="/coaches" className="rounded-md bg-[#12355b] px-3 py-2 text-white hover:bg-[#0d2948] sm:px-4">
            Find Coaches
          </Link>
          <Link href="/account/login" className="hover:text-slate-950">
            Sign In / Sign Up
          </Link>
        </div>
      </nav>
    </header>
  );
}
