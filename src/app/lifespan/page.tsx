import type { Metadata } from "next";
import Link from "next/link";
import LifespanChart from "@/components/lifespan/LifespanChart";
import { lifespanChartRows } from "@/components/lifespan/lifespan-chart";
import PlanEveryReplacement from "@/components/lifespan/PlanEveryReplacement";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getLibrary, getTypicalCosts } from "@/lib/library/source";
import { pageMetadata } from "@/lib/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "How Long Do Building Components Last? Lifespan and Cost Chart",
  description:
    "Typical useful life and replacement cost of roofs, HVAC, water heaters, appliances, flooring and more in a rental building, in one sortable chart.",
  path: "/lifespan",
});

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";
const sectionHeading = "text-xl font-semibold text-slate-950 dark:text-white";

export default async function LifespanIndex() {
  const [library, typicalCosts] = await Promise.all([getLibrary(), getTypicalCosts()]);
  const rows = lifespanChartRows(library, typicalCosts);

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            How long do building components last?
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            Typical useful life and replacement cost for the big-ticket items in a rental building. Pick one to see what
            affects it and when yours is likely due, or put all of yours into the{" "}
            <Link href="/capex-calculator" className={link}>
              free CapEx calculator
            </Link>
            .
          </p>

          <section className="mt-10" aria-labelledby="chart-heading">
            <h2 id="chart-heading" className={sectionHeading}>
              Lifespan and replacement cost chart
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Choose a column heading to sort the chart.</p>
            <div className="mt-4">
              <LifespanChart rows={rows} />
            </div>
          </section>

          <section className="mt-10" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" className={sectionHeading}>
              About these numbers
            </h2>
            <div className="mt-3 space-y-3 text-slate-600 dark:text-slate-300">
              <p>
                Typical life is the usual range for each component. Where yours falls depends on how it was installed,
                how hard it&apos;s used and how well it&apos;s kept up. The calculator starts from the middle of the
                range, and you can change it for your building.
              </p>
              <p>
                Replacement costs are typical installed prices in today&apos;s dollars, from a basic job to a typical
                upper end, worked out from the cost guides named under each one. Items in each apartment are priced per
                apartment, so the windows figure covers all the windows in one apartment. Flooring and paving are priced
                per sq ft. Building-wide items like the roof or a boiler get a price that doesn&apos;t depend on the
                building&apos;s size, such as a price per sq ft of roof.
              </p>
              <p>
                Costs vary a lot by region and building, so use your own quotes where you have them. These figures are
                for comparing: the calculator only uses the costs you enter.
              </p>
            </div>
          </section>

          <PlanEveryReplacement className="mt-12" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
