import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SignOutButton from "@/components/account/SignOutButton";
import TrackWelcome from "@/components/account/TrackWelcome";
import { SiteFooter } from "@/components/SiteChrome";
import { supabaseEnv } from "@/lib/supabase/env";
import { getAccount } from "./account";

export const metadata: Metadata = {
  title: "My properties | CapexClock",
  robots: { index: false },
};

// Padded to a comfortable tap size; nowrap so "My properties" never splits over two lines.
const navLink =
  "whitespace-nowrap py-2 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  // Accounts aren't set up on this deployment.
  if (!supabaseEnv()) notFound();
  const { id: userId, email } = await getAccount();

  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
          <nav className="flex flex-wrap items-center gap-x-5">
            <Link href="/app" className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              CapexClock
            </Link>
            {/* Phones go there with the logo, which keeps the header to one row. */}
            <Link href="/app" className={`${navLink} hidden sm:inline`}>
              My properties
            </Link>
            <Link href="/capex-calculator" className={navLink}>
              Calculator
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {email && <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{email}</span>}
            <SignOutButton className={navLink} />
          </div>
        </div>
      </header>
      <Suspense>
        <TrackWelcome userId={userId} />
      </Suspense>
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
