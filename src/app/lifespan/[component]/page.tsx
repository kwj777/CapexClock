import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import LifespanEstimator from "@/components/lifespan/LifespanEstimator";
import { defaultLife, UNIT_LABEL_TEXT, type LibraryComponent } from "@/lib/library/components";
import { LIFESPAN_NOTES } from "@/lib/library/content";
import { capitalize, subjectFor, titleCase } from "@/lib/library/phrasing";
import { getLibrary } from "@/lib/library/source";
import { SITE_URL } from "@/lib/site";

// Library edits in Supabase show up within an hour; new components get pages on first visit.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getLibrary()).map((c) => ({ component: c.slug }));
}

async function findComponent(slug: string): Promise<{ item: LibraryComponent; library: LibraryComponent[] } | null> {
  const library = await getLibrary();
  const item = library.find((c) => c.slug === slug);
  return item ? { item, library } : null;
}

export async function generateMetadata({ params }: PageProps<"/lifespan/[component]">): Promise<Metadata> {
  const found = await findComponent((await params).component);
  if (!found) return {};
  const { item } = found;
  const { noun, plural } = subjectFor(item);
  const title = `How Long ${plural ? "Do" : "Does"} ${titleCase(noun)} Last? (${item.lifeLow}–${item.lifeHigh} Years) | CapexClock`;
  const description = `${capitalize(noun)} typically ${plural ? "last" : "lasts"} ${item.lifeLow} to ${item.lifeHigh} years. See what shortens ${plural ? "their" : "its"} life, the signs ${plural ? "they're" : "it's"} near the end, and how much to set aside for replacement.`;
  return {
    title,
    description,
    alternates: { canonical: `/lifespan/${item.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/lifespan/${item.slug}` },
  };
}

export default async function LifespanPage({ params }: PageProps<"/lifespan/[component]">) {
  const found = await findComponent((await params).component);
  if (!found) notFound();
  const { item, library } = found;
  const notes = LIFESPAN_NOTES[item.slug];
  const life = defaultLife(item);
  const { noun, plural } = subjectFor(item);
  const does = plural ? "do" : "does";
  const lasts = plural ? "last" : "lasts";
  const related = library.filter((c) => c.category === item.category && c.slug !== item.slug);

  const faq = [
    {
      q: `How long ${does} ${noun} last?`,
      a: `Typically ${item.lifeLow} to ${item.lifeHigh} years. CapexClock uses ${life} years as its default, and you can change it for your building.`,
    },
    {
      q: `When should I start saving to replace ${noun}?`,
      a: `As soon as ${plural ? "they're" : "it's"} installed. Spreading the cost over ${plural ? "their" : "its"} ${item.lifeLow}–${item.lifeHigh} year life keeps the replacement from landing as a surprise. The mini calculator on this page shows a monthly amount for yours.`,
    },
    {
      q: `How ${plural ? "are" : "is"} ${noun} priced in the calculator?`,
      a: `By default ${plural ? "they're" : "it's"} priced ${UNIT_LABEL_TEXT[item.unitLabel]}. Enter your own quote or recent invoice; CapexClock never fills in costs for you.`,
    },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <nav className="text-sm text-slate-500 dark:text-slate-400">
            <Link href="/lifespan" className="hover:text-slate-900 dark:hover:text-white">
              Component lifespans
            </Link>{" "}
            / {item.category}
          </nav>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            How long {does} {noun} last?
          </h1>
          <p className="mt-4 text-lg text-pretty text-slate-600 dark:text-slate-300">
            {capitalize(noun)} typically {lasts}{" "}
            <strong className="text-slate-950 dark:text-white">
              {item.lifeLow} to {item.lifeHigh} years
            </strong>
            . Where yours {plural ? "fall" : "falls"} in that range depends on how {plural ? "they were" : "it was"} installed, how hard {plural ? "they work" : "it works"} and how well{" "}
            {plural ? "they're" : "it's"} maintained.
          </p>

          <div className="mt-8">
            <LifespanEstimator item={item} />
          </div>

          {notes && (
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <section>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">What affects {plural ? "their" : "its"} lifespan</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-600 dark:text-slate-300">
                  {notes.factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Signs {plural ? "they're" : "it's"} near the end</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-600 dark:text-slate-300">
                  {notes.signs.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Questions</h2>
            <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {faq.map(({ q, a }) => (
                <div key={q} className="py-4">
                  <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                  <dd className="mt-1 text-slate-600 dark:text-slate-400">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-12 rounded-2xl bg-slate-950 p-6 text-white dark:bg-slate-900 dark:ring-1 dark:ring-slate-800">
            <h2 className="text-xl font-semibold">Plan every replacement in your building</h2>
            <p className="mt-2 text-slate-300">
              List your roof, HVAC, water heaters and more to get a 10-year forecast and one monthly reserve number.
            </p>
            <Link href="/capex-calculator" className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400">
              Open the free CapEx calculator
            </Link>
          </section>

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Other {item.category.toLowerCase()} lifespans</h2>
              <ul className="mt-3 space-y-1.5">
                {related.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/lifespan/${c.slug}`} className="text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
                      {c.name}
                    </Link>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      {c.lifeLow}–{c.lifeHigh} years
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
