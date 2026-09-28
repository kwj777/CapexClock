import type { Metadata } from "next";
import Link from "next/link";
import CalculatorLoader from "@/components/calculator/CalculatorLoader";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getLibrary } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";
import { supabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = pageMetadata({
  title: "Free CapEx Calculator for Rental Properties | CapexClock",
  description:
    "Enter your roof, HVAC, water heaters and more with install years and costs. Get a 10-year replacement forecast and a monthly reserve per unit. Free.",
  path: "/capex-calculator",
});

const FAQ = [
  {
    q: "How is the monthly reserve calculated?",
    a: "It's the smallest steady monthly amount that, starting from zero, has the cash ready for every replacement on time. We look 30 years ahead so a big item due just after the 10-year chart is still saved for. Anything overdue or due this year is shown separately as needed now, since there's no time to save for it. The per-unit figure divides the monthly reserve by your number of units.",
  },
  {
    q: "What if I don't know when something was installed?",
    a: "Leave the install year blank and enter the year your building was built. We use it as the install year and mark the item as an estimate so you know which dates to confirm.",
  },
  {
    q: "What happens to items that are already past their useful life?",
    a: "They're counted in this year's costs and flagged as overdue, then repeat on their normal cycle.",
  },
  {
    q: "Does the forecast include inflation?",
    a: "No. Costs are in today's dollars, so enter current replacement quotes.",
  },
  {
    q: "Is my data saved?",
    a: "Your entries stay in this browser until you choose to save them. A free account keeps them safe and lets you add more properties.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default async function CapexCalculatorPage() {
  const library = await getLibrary();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            CapEx calculator for rental properties
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-300">
            List your building&apos;s major components with install years and replacement costs.
            See what&apos;s due over the next 10 years and how much to reserve each month. Free, no
            signup.
          </p>

          <div className="mt-8">
            <CalculatorLoader accountsEnabled={supabaseEnv() !== null} library={library} />
          </div>

          <section className="mt-16 max-w-3xl" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              How the calculator works
            </h2>
            <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-5">
                  <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                  <dd className="mt-1.5 text-slate-600 dark:text-slate-400">{a}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-slate-600 dark:text-slate-300">
              Want to save properties and get reminders?{" "}
              <Link href="/#signup" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
                Get early access
              </Link>
              .
            </p>
          </section>

          <p className="mt-10 max-w-3xl text-slate-600 dark:text-slate-400">
            More free tools: the{" "}
            <Link href="/reserve-calculator" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              reserve calculator
            </Link>{" "}
            for expenses you already know about, and{" "}
            <Link href="/lifespan" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              typical lifespans
            </Link>{" "}
            for 25 building components.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
