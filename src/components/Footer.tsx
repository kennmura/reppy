import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>Helping athletes discover local sports coaches for private and small-group training.</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/" className="hover:text-slate-950">
            Home
          </Link>
          <Link href="/coaches" className="hover:text-slate-950">
            Coaches
          </Link>
          <Link href="/for-coaches" className="hover:text-slate-950">
            For Coaches
          </Link>
          <Link href="/privacy" className="hover:text-slate-950">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-950">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-slate-950">
            Contact
          </Link>
          <Link href="/admin" className="hover:text-slate-950">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
