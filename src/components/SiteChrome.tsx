import Link from "next/link";
import { supabaseEnv } from "@/lib/supabase/env";
import { CONTACT_EMAIL } from "@/lib/site";

const navLink =
  "whitespace-nowrap text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <ClockMark />
        CapexClock
      </Link>
      <nav className="flex items-center gap-4 sm:gap-5">
        <Link href="/capex-calculator" className={navLink}>
          Calculator
        </Link>
        {/* On small phones the landing page's own signup section covers this. */}
        <Link href="/#signup" className={`${navLink} hidden sm:inline`}>
          Early access
        </Link>
        {supabaseEnv() && (
          <Link href="/app" className={navLink}>
            Sign in
          </Link>
        )}
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
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth="3.6" />
      <path d="M16 3A13 13 0 1 1 3 16" fill="none" stroke="#f59e0b" strokeWidth="3.6" strokeLinecap="round" />
      <path d={DOLLAR} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const DOLLAR =
  "M19.6 12.2C19 10.9 17.7 10.3 16 10.3C13.9 10.3 12.5 11.4 12.5 12.9C12.5 16.6 19.7 15.1 19.7 19.1C19.7 20.7 18.2 21.8 16 21.8C14.1 21.8 12.8 21.1 12.2 19.8M16 8.2V23.8";
