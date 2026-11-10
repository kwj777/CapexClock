import type { Metadata } from "next";
import Link from "next/link";
import PlanEveryReplacement from "@/components/lifespan/PlanEveryReplacement";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { formatPostDate, livePosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";

// Hourly, so a post dated in the future (already deployed, see src/lib/blog.ts) appears on its date.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "CapEx Blog for Small Rental Owners",
  description:
    "Plain-English guides to capital expenditures, replacement reserves and component lifespans for owners of 1 to 50 rental units.",
  path: "/blog",
});

export default function BlogIndex() {
  const posts = livePosts();
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">CapEx blog</h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            Plain-English guides to planning for roofs, HVAC, water heaters and the other big replacements in a small rental
            portfolio.
          </p>
          {posts.length === 0 ? (
            <p className="mt-10 text-slate-600 dark:text-slate-300">The first post is on its way.</p>
          ) : (
            <ul className="mt-10 space-y-4">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="block rounded-2xl border border-slate-200 p-5 hover:border-amber-500 dark:border-slate-800 dark:hover:border-amber-400"
                  >
                    <span className="block text-lg font-semibold text-slate-950 dark:text-white">{p.title}</span>
                    <span className="mt-1 block text-slate-600 dark:text-slate-300">{p.description}</span>
                    <time dateTime={p.date} className="mt-2 block text-sm text-slate-500 dark:text-slate-400">
                      {formatPostDate(p.date)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <PlanEveryReplacement className="mt-12" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
