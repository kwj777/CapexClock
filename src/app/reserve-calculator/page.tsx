import type { Metadata } from "next";
import Link from "next/link";
import ReserveCalculator from "@/components/reserve/ReserveCalculator";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const title = "Reserve Calculator for Rental Properties | CapexClock";
const description =
  "Enter upcoming replacements, when they're due and your current reserve balance. Get the monthly amount to save, and per unit, so the cash is there on time. Free, no signup.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/reserve-calculator" },
  openGraph: { title, description, url: "/reserve-calculator" },
};

const FAQ = [
  {
    q: "How is the monthly amount calculated?",
    a: "It's the smallest steady monthly deposit that has enough saved for each expense by the year it's due, after counting your current balance. When an expensive item comes early, the amount is set by that item rather than by the average, so you never run short.",
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
    a: "Enough to pay for every major replacement when it comes due. A rule of thumb like a percent of rent can be far too low for an older building, which is why this calculator works from your actual upcoming expenses.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function ReserveCalculatorPage() {
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
            Already know what&apos;s coming up? List each expense and when it&apos;s due to see how much to set aside every
            month. Free, no signup.
          </p>
          <div className="mt-8">
            <ReserveCalculator />
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
