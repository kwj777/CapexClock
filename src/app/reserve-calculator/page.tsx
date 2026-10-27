import type { Metadata } from "next";
import Link from "next/link";
import QuickEstimate from "@/components/reserve/QuickEstimate";
import ReserveCalculator from "@/components/reserve/ReserveCalculator";
import ReserveTabs from "@/components/reserve/ReserveTabs";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getLibrary, getTypicalCosts } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";
import { SPREAD_REPLACEMENTS } from "@/verticals/landlord";

export const metadata: Metadata = pageMetadata({
  title: "Reserve Calculator for Rental Properties | CapexClock",
  description:
    "Estimate a monthly reserve per unit from your building's age and systems, or list known expenses and when they're due. Free, no signup.",
  path: "/reserve-calculator",
});

const FAQ = [
  {
    q: "How does the quick estimate work?",
    a: `It takes each system you tick to have been replaced on schedule since the building was built${
      SPREAD_REPLACEMENTS ? ", with its replacements spread across its typical lifespan rather than all in one year" : ""
    }. It prices each at typical low and high installed costs and works out the monthly amount the same way as the full calculator. Building-wide items like the roof are shared out per apartment for a 12-unit building. Typical costs are not quotes, so use your own numbers in the CapEx calculator to plan.`,
  },
  {
    q: "How is the monthly amount calculated for listed expenses?",
    a: "It's the smallest monthly deposit that has enough saved for each expense by the year it's due, after counting your current balance. When an expensive item comes early, the amount is set by that item rather than by the average, so you never run short. Once that item is paid you'll need less, and the calculator shows about how much.",
  },
  {
    q: "What does 0 years until due mean?",
    a: "The expense is due now. It's paid from your current balance first, and any gap is shown as short right now because there's no time to save for it.",
  },
  {
    q: "Does it include inflation or interest?",
    a: "No. Enter costs in today's dollars. Update your costs each year as quotes change.",
  },
  {
    q: "How much should a rental property keep in reserves?",
    a: "Enough to pay for every major replacement when it comes due. A rule of thumb like a percent of rent can be far too low for an older building, which is why this calculator works from your building's own systems and expenses.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default async function ReserveCalculatorPage() {
  const [library, typicalCosts] = await Promise.all([getLibrary(), getTypicalCosts()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            Reserve calculator for rental properties
          </h1>
          <p className="mt-3 text-lg text-pretty text-slate-600 dark:text-slate-300">
            See how much to set aside every month. Start with a quick estimate from your building&apos;s age and
            systems, or list the expenses you already know about. Free, no signup.
          </p>
          <div className="mt-8">
            <ReserveTabs
              panels={{
                quick: <QuickEstimate library={library} typicalCosts={typicalCosts} />,
                expenses: <ReserveCalculator />,
              }}
            />
          </div>
          <section className="mt-16" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              How it works
            </h2>
            <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-5">
                  <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                  <dd className="mt-2 text-slate-600 dark:text-slate-400">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="mt-10 text-slate-600 dark:text-slate-400">
            Not sure how long your components last? See{" "}
            <Link href="/lifespan" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              typical lifespans
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
