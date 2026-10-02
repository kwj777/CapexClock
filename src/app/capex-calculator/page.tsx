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
    q: "How do I enter costs?",
    a: "Enter what a replacement would cost today, from a quote or your best estimate. Items counted per unit are priced per apartment, so for windows enter the cost of all the windows in one apartment. If you type your own count instead, such as 90 windows, the cost is for each one. Every row shows its math, like 12 × $650 = $7,800.",
  },
  {
    q: "What if I don't know when something was installed?",
    a: "Leave the install year blank and enter the year your building was built. We use it as the install year and mark the item as an estimate so you know which dates to confirm. If you have a rough idea, enter your best guess and tick Guess under it. It's marked as an estimate the same way.",
  },
  {
    q: "What does Replace this year do?",
    a: "Tick it for anything you plan to replace this year, even if it still works. Its cost is added to this year's costs and its replacement cycle starts again from this year. If you already replaced something, don't tick it. Enter the year you replaced it as the install year instead.",
  },
  {
    q: "Should I replace everything at risk now?",
    a: "Open \"What if we replace everything at risk now?\" under At risk to compare. It shows the cash you'd need this year, how the 10-year total changes and what happens to the monthly reserve. If waiting until something breaks costs more, such as rush fees, you can add that as a percentage. Items whose install year is a guess are listed apart so you can check them first. Nothing changes until you click Apply, and you can undo it.",
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
  {
    q: "Can I import my own spreadsheet?",
    a: "Yes. Click Import from a spreadsheet, then paste rows from Excel or Google Sheets, or choose an Excel (.xlsx) or CSV file. We guess which column is which, match names like \"HWH\" to our list, and combine identical rows into one with a quantity. You can change any guess, and you see every row before anything is added. Your sheet is read in your browser and never uploaded. Starting from scratch? Our free CapEx spreadsheet template has the columns to fill in.",
  },
  {
    q: "Can I edit my list in a spreadsheet and bring it back?",
    a: "Yes. Click Download component list (CSV), make your changes in Excel or Google Sheets, then import the file again. Each row keeps its CapexClock ID, so changed rows are updated in place and new rows are added. Rows you deleted are only removed if you say so.",
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
              Want a reminder before something comes due?{" "}
              <Link href="/#signup" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
                Get early access to reminders
              </Link>
              .
            </p>
          </section>

          <p className="mt-10 max-w-3xl text-slate-600 dark:text-slate-400">
            More free tools: a{" "}
            <Link href="/capex-spreadsheet-template" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              CapEx spreadsheet template
            </Link>{" "}
            with the columns to track, the{" "}
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
