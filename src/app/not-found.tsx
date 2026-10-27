import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Page not found | CapexClock",
};

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

// Mistyped or old links, and anything that calls notFound() outside /app.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            The link may be mistyped, or the page may have moved.
          </p>
          <Link
            href="/capex-calculator"
            className="mt-8 inline-block rounded-lg bg-amber-500 px-5 py-3 font-semibold text-slate-950 hover:bg-amber-400"
          >
            Try the free calculator
          </Link>
          <p className="mt-6 text-slate-600 dark:text-slate-300">
            Or see{" "}
            <Link href="/lifespan" className={link}>
              how long roofs, HVAC and water heaters last
            </Link>
            , or go to the{" "}
            <Link href="/" className={link}>
              home page
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
