import Link from "next/link";
import { supabaseEnv } from "@/lib/supabase/env";
import { CONTACT_EMAIL } from "@/lib/site";

const navLink =
  "whitespace-nowrap text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

const TOOLS = [
  { href: "/capex-calculator", label: "CapEx calculator", short: "Calculator" },
  { href: "/reserve-calculator", label: "Reserve calculator", short: "Reserve calculator" },
  { href: "/lifespan", label: "Lifespans", short: "Lifespans" },
];

export function SiteHeader() {
  const tools = (short: boolean) =>
    TOOLS.map((t) => (
      <Link key={t.href} href={t.href} className={navLink}>
        {short ? t.short : t.label}
      </Link>
    ));
  return (
    <header className="mx-auto w-full max-w-6xl px-4 pb-3 pt-5 sm:px-6 md:pb-5">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ClockMark />
          CapexClock
        </Link>
        <nav aria-label="Free tools" className="hidden items-center gap-5 md:flex">
          {tools(false)}
        </nav>
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Below lg the landing page's own signup section covers this. */}
          <Link href="/#signup" className={`${navLink} hidden lg:inline`}>
            Early access
          </Link>
          {/* No prefetch: /app runs the auth proxy, which public pages shouldn't trigger. */}
          {supabaseEnv() && (
            <Link href="/app" prefetch={false} className={navLink}>
              Sign in
            </Link>
          )}
        </div>
      </div>
      {/* Phones and tablets get the tools on their own row so nothing is squeezed. */}
      <nav aria-label="Free tools" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 md:hidden">
        {tools(true)}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 dark:text-slate-400 sm:px-6">
        <p>© {new Date().getFullYear()} CapexClock</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Tools">
          <Link href="/capex-calculator" className="hover:text-slate-900 dark:hover:text-white">
            CapEx calculator
          </Link>
          <Link href="/reserve-calculator" className="hover:text-slate-900 dark:hover:text-white">
            Reserve calculator
          </Link>
          <Link href="/lifespan" className="hover:text-slate-900 dark:hover:text-white">
            Component lifespans
          </Link>
        </nav>
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
