import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

const navLink =
  "text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <ClockMark />
        CapexClock
      </Link>
      <nav className="flex items-center gap-5">
        <Link href="/capex-calculator" className={navLink}>
          Calculator
        </Link>
        <Link href="/#signup" className={navLink}>
          Early access
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
        <p>© {new Date().getFullYear()} CapexClock</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-slate-900 dark:hover:text-white">
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}

function ClockMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f59e0b" />
      <path d="M12 6.5V12l3.5 2" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
