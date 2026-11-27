import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import LifespanEstimator from "@/components/lifespan/LifespanEstimator";
import PlanEveryReplacement from "@/components/lifespan/PlanEveryReplacement";
import { formatCostRange } from "@/components/calculator/format";
import { getLibrary, getTypicalCosts } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";
import {
  buildingCostOf,
  capitalize,
  defaultLife,
  lifeDrivers,
  lifespanDescription,
  lifespanTitle,
  notesFor,
  relatedHeading,
  subjectFor,
  TYPICAL_COST_SOURCES,
  typicalCostBasis,
  UNIT_LABEL_TEXT,
  type LibraryComponent,
  type TypicalCost,
} from "@/verticals/landlord";

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
  return pageMetadata({
    title: lifespanTitle(item),
    description: lifespanDescription(item, notesFor(item.slug) !== undefined),
    path: `/lifespan/${item.slug}`,
  });
}

export default async function LifespanPage({ params }: PageProps<"/lifespan/[component]">) {
  const found = await findComponent((await params).component);
  if (!found) notFound();
  const { item, library } = found;
  const typical = (await getTypicalCosts()).find((c) => c.slug === item.slug);
  const notes = notesFor(item.slug);
  const life = defaultLife(item);
  const cost = costSummary(item, typical);
  const { noun, plural } = subjectFor(item);
  const does = plural ? "do" : "does";
  const lasts = plural ? "last" : "lasts";
  const sameCategory = library.filter((c) => c.category === item.category && c.slug !== item.slug);
  // A category of one still links on to a few others.
  const related = sameCategory.length > 0 ? sameCategory : library.filter((c) => c.slug !== item.slug).slice(0, 5);

  const faq = [
    {
      q: `How long ${does} ${noun} last?`,
      a: `Typically ${item.lifeLow} to ${item.lifeHigh} years. CapexClock uses ${life} years as its default, and you can change it for your building.`,
    },
    ...(cost
      ? [
          {
            q: `How much does it cost to replace ${noun}?`,
            a: `${cost.sentence} Prices vary a lot by region and job, so use a local quote when you plan.`,
          },
        ]
      : []),
    {
      q: `When should I start saving to replace ${noun}?`,
      a: `From day one. Spreading the cost over ${plural ? "their" : "its"} ${item.lifeLow}–${item.lifeHigh} year life keeps the replacement from landing as a surprise. Add a replacement cost to the mini calculator on this page to see a monthly amount for yours.`,
    },
    {
      q: `How ${plural ? "are" : "is"} ${noun} priced in the calculator?`,
      a: `By default ${plural ? "they're" : "it's"} priced ${UNIT_LABEL_TEXT[item.unitLabel]}. Enter your own quote or recent invoice. Where we have one, we show a typical range to compare with; the math only uses the cost you enter.`,
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
      <main id="main" className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
            <ol className="flex flex-wrap gap-x-1.5">
              <li>
                <Link href="/lifespan" className="hover:text-slate-900 dark:hover:text-white">
                  Component lifespans
                </Link>
              </li>
              <li>
                <span aria-hidden="true">› </span>
                {item.category}
              </li>
              <li aria-current="page">
                <span aria-hidden="true">› </span>
                {item.name}
              </li>
            </ol>
          </nav>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            How long {does} {noun} last?
          </h1>
          <p className="mt-4 text-lg text-pretty text-slate-600 dark:text-slate-300">
            {capitalize(noun)} typically {lasts}{" "}
            <strong className="text-slate-950 dark:text-white">
              {item.lifeLow} to {item.lifeHigh} years
            </strong>
            . Where yours {plural ? "fall" : "falls"} in that range depends on {lifeDrivers(item)}.
          </p>

          {notes?.safety && (
            <p
              role="note"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
            >
              <strong className="font-semibold">Safety first:</strong> {notes.safety}
            </p>
          )}

          <div className="mt-8">
            <LifespanEstimator item={item} typical={typical} />
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

          {cost && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">What a replacement costs</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">{cost.sentence}</p>
              {cost.basis && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Based on {cost.basis}.</p>}
              {cost.sources.length > 0 && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Source:{" "}
                  {cost.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && ", "}
                      <a href={src.url} rel="nofollow noopener" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
                        {src.name}
                      </a>
                    </span>
                  ))}
                  . Use your own quote in the calculator; prices vary by region.
                </p>
              )}
            </section>
          )}

          {notes?.rental && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">In a rental</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">{notes.rental}</p>
            </section>
          )}

          {notes?.repairOrReplace && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Repair or replace?</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">{notes.repairOrReplace}</p>
            </section>
          )}

          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            This is general guidance, not an inspection. If something about yours worries you, have a licensed pro look
            at it.
          </p>

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

          <PlanEveryReplacement className="mt-12" />

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                {sameCategory.length > 0 ? relatedHeading(item.category) : "More component lifespans"}
              </h2>
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

/**
 * The typical replacement cost as a sentence, with how it was worked out and its
 * sources, or null when there's no typical cost. Per apartment or per sq ft, as
 * the calculator prices it; a building-wide item also gets its building price
 * (per sq ft of roof, one boiler), since a 12-unit building's share is only one
 * way to read it.
 */
function costSummary(item: LibraryComponent, typical: TypicalCost | undefined) {
  if (!typical) return null;
  const range = formatCostRange(typical.low, typical.high);
  const building = item.unitLabel === "per_building" ? buildingCostOf(item.slug, typical) : null;
  let sentence: string;
  if (typical.per === "sq_ft") {
    sentence = `Typically ${range} per square foot, installed.`;
  } else if (item.unitLabel === "per_building") {
    sentence = building
      ? `Typically ${formatCostRange(building.low, building.high)} ${building.what}, or about ${range} per apartment in a 12-unit building.`
      : `Typically about ${range} per apartment in a 12-unit building.`;
  } else {
    sentence = `Typically ${range} per apartment, installed.`;
  }
  return {
    sentence,
    basis: typicalCostBasis(typical),
    sources: TYPICAL_COST_SOURCES.get(item.slug) ?? [],
  };
}
