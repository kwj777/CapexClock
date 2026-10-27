import Link from "next/link";

/** The dark card under the lifespan pages that leads on to the calculator. */
export default function PlanEveryReplacement({ className = "" }: { className?: string }) {
  return (
    <section className={`rounded-2xl bg-slate-950 p-6 text-white dark:bg-slate-900 dark:ring-1 dark:ring-slate-800 ${className}`}>
      <h2 className="text-xl font-semibold">Plan every replacement in your building</h2>
      <p className="mt-2 text-slate-300">
        List your roof, HVAC, water heaters and more to get a 10-year forecast and one monthly reserve number.
      </p>
      <Link href="/capex-calculator" className="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-400">
        Open the free CapEx calculator
      </Link>
    </section>
  );
}
