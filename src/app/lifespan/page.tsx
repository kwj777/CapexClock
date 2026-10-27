import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getLibrary } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "How Long Do Building Components Last? Lifespan Chart",
  description:
    "Typical useful life of roofs, HVAC, water heaters, appliances, flooring and more in rental buildings, with a free calculator for when yours are due.",
  path: "/lifespan",
});

export default async function LifespanIndex() {
  const library = await getLibrary();
  // A Map, so a category named like a built-in object property ("constructor") still groups.
  const groups = new Map<string, typeof library>();
  for (const c of library) {
    const group = groups.get(c.category);
    if (group) group.push(c);
    else groups.set(c.category, [c]);
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            How long do building components last?
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            Typical useful life for the big-ticket items in a rental building. Pick one to see what affects it and
            when yours is likely due.
          </p>
          <div className="mt-10 space-y-8">
            {[...groups].map(([category, items]) => (
              <section key={category}>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{category}</h2>
                <table className="mt-2 w-full text-left">
                  <thead className="sr-only">
                    <tr>
                      <th>Component</th>
                      <th>Typical life</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((c) => (
                      <tr key={c.slug}>
                        <td className="py-2">
                          <Link href={`/lifespan/${c.slug}`} className="text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {c.lifeLow}–{c.lifeHigh} years
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
