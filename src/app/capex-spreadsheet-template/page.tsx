import type { Metadata } from "next";
import Link from "next/link";
import TemplateImport from "@/components/import/TemplateImport";
import TemplateLink from "@/components/import/TemplateLink";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CONDITION_TEXT } from "@/components/calculator/draft";
import { EXAMPLE_BUILDING, exampleRows } from "@/lib/export/component-list";
import { COUNTED_PER_TEXT, FORMAT_COLUMNS } from "@/lib/import/format";
import { getLibrary } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";
import { supabaseEnv } from "@/lib/supabase/env";
import { FAQ, faqJsonLd } from "./faq";

export const metadata: Metadata = pageMetadata({
  title: "Free CapEx Spreadsheet Template for Rental Properties | CapexClock",
  description:
    "A free capital expenditure spreadsheet template for rental properties: the columns to track for your roof, HVAC, water heaters and more, a filled-in example, and an import into a free 10-year forecast.",
  path: "/capex-spreadsheet-template",
});

const link = "font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";
const sectionHeading = "text-2xl font-semibold tracking-tight text-slate-950 dark:text-white";
const downloadButton =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ring-1 transition";
const cellClass = "px-3 py-2 align-top";

export default async function SpreadsheetTemplatePage() {
  const library = await getLibrary();
  const example = exampleRows();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            CapEx spreadsheet template for rental properties
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-300">
            One row for each big item you&apos;ll replace someday, with when it went in, how long it lasts and what it
            costs. Fill it in, then import it to see what&apos;s due over the next 10 years and how much to set aside
            each month. Free, no signup.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <TemplateLink
              file="template"
              where="template_page"
              className={`${downloadButton} bg-amber-500 text-slate-950 ring-amber-500 hover:bg-amber-400`}
            >
              Download the template (CSV)
            </TemplateLink>
            <TemplateLink
              file="example"
              where="template_page"
              className={`${downloadButton} bg-white text-slate-800 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800`}
            >
              Download the filled-in example (CSV)
            </TemplateLink>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            CSV files open in Excel, Google Sheets and Numbers. Save it as .xlsx if you like: the import reads both.
          </p>

          <section className="mt-14 max-w-3xl" aria-labelledby="columns-heading">
            <h2 id="columns-heading" className={sectionHeading}>
              What to track, and why
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              The template has {FORMAT_COLUMNS.length} columns. For a forecast, each row needs a Component and a Cost each,
              and a Useful life for anything we don&apos;t know by name. Leave Install year blank to use the year built,
              and leave Quantity blank on anything counted per unit to use the unit count. The rest make it more useful.
            </p>
            <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {FORMAT_COLUMNS.map((c) => (
                <div key={c.heading} className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="font-semibold text-slate-950 dark:text-white">{c.heading}</dt>
                  <dd className="text-slate-600 dark:text-slate-400">
                    <p className="text-slate-800 dark:text-slate-200">{c.what}</p>
                    <p className="mt-1">{c.why}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-14" aria-labelledby="example-heading">
            <h2 id="example-heading" className={sectionHeading}>
              A filled-in example
            </h2>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-400">
              {EXAMPLE_BUILDING.name.replace(/^Example: /, "A ")}, built in {EXAMPLE_BUILDING.yearBuilt}. The download
              has every column, with the building&apos;s name, units and year built on each row.
            </p>
            <div
              role="region"
              aria-labelledby="example-heading"
              tabIndex={0}
              className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
            >
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    {["Component", "Quantity", "Counted per", "Install year", "Useful life", "Cost each", "Condition", "Notes"].map((h) => (
                      <th key={h} scope="col" className={`${cellClass} font-semibold`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {example.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className={`${cellClass} font-medium text-slate-950 dark:text-white`}>
                        {r.name}
                      </th>
                      <td className={`${cellClass} tabular-nums`}>{Number(r.quantity).toLocaleString("en-US")}</td>
                      <td className={cellClass}>{COUNTED_PER_TEXT[r.unitLabel]}</td>
                      <td className={`${cellClass} tabular-nums`}>
                        {r.installYear}
                        {r.installYearIsGuess && <span className="text-slate-500 dark:text-slate-400"> (a guess)</span>}
                      </td>
                      <td className={`${cellClass} tabular-nums`}>{r.usefulLife}</td>
                      <td className={`${cellClass} tabular-nums`}>${Number(r.costEach).toLocaleString("en-US")}</td>
                      <td className={cellClass}>
                        {r.condition ? CONDITION_TEXT[r.condition] : ""}
                        {r.scenario === "replace_now" && <span className="block text-slate-500 dark:text-slate-400">Replace now</span>}
                      </td>
                      <td className={cellClass}>{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-14 max-w-3xl" aria-labelledby="import-heading">
            <h2 id="import-heading" className={sectionHeading}>
              Import your spreadsheet
            </h2>
            <p className="mt-3 mb-5 text-slate-600 dark:text-slate-400">
              Already have a sheet? Excel and CSV files both work, in these columns or your own. You see every row
              before anything is added, and the rows go into the{" "}
              <Link href="/capex-calculator" className={link}>
                free CapEx calculator
              </Link>
              .
            </p>
            <TemplateImport library={library} accountsEnabled={supabaseEnv() !== null} />
          </section>

          <section className="mt-16 max-w-3xl" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className={sectionHeading}>
              Questions about the template
            </h2>
            <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-5">
                  <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                  <dd className="mt-1.5 text-slate-600 dark:text-slate-400">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="mt-10 max-w-3xl text-slate-600 dark:text-slate-400">
            More free tools: the{" "}
            <Link href="/capex-calculator" className={link}>
              CapEx calculator
            </Link>
            , the{" "}
            <Link href="/reserve-calculator" className={link}>
              reserve calculator
            </Link>{" "}
            for expenses you already know about, and{" "}
            <Link href="/lifespan" className={link}>
              typical lifespans
            </Link>{" "}
            for {library.length} building components.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
