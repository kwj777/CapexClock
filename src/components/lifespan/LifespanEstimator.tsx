"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/components/calculator/format";
import { loadDraft, rowFromLibrary, saveDraft } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { computeForecast } from "@/lib/forecast";
import { defaultLife, type LibraryComponent } from "@/lib/library/components";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";

function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "When will mine need replacing, and what should I set aside?" for one component. */
export default function LifespanEstimator({ item }: { item: LibraryComponent }) {
  const router = useRouter();
  const [startYear] = useState(() => new Date().getFullYear());
  const [installYear, setInstallYear] = useState("");
  const [quantity, setQuantity] = useState(item.unitLabel === "per_building" ? "1" : "");
  const [cost, setCost] = useState("");

  const life = defaultLife(item);
  const year = num(installYear);
  const validYear = year !== null && Number.isInteger(year) && year >= 1900 && year <= startYear;
  const qty = num(quantity) ?? 0;
  const each = num(cost);

  let result: { due: number; low: number; high: number; monthly: number | null; neededNow: number | null } | null = null;
  if (validYear) {
    let monthly: number | null = null;
    let neededNow: number | null = null;
    if (each !== null && each >= 0 && qty > 0) {
      const f = computeForecast({
        startYear,
        unitCount: 0,
        components: [
          { id: item.slug, category: item.category, name: item.name, quantity: qty, installYear: year, usefulLifeYears: life, replacementCostEach: each },
        ],
      });
      monthly = f.monthlyReserve;
      neededNow = f.neededNow;
    }
    result = { due: year + life, low: year + item.lifeLow, high: year + item.lifeHigh, monthly, neededNow };
  }

  function addToForecast() {
    const draft = loadDraft();
    const row = {
      ...rowFromLibrary(item, draft.unitCount),
      installYear: installYear.trim(),
      ...(quantity.trim() ? { quantity: quantity.trim() } : {}),
      costEach: cost.trim(),
    };
    saveDraft({ ...draft, rows: [...draft.rows, row] });
    void track("lifespan_added_to_calculator", { component: item.slug });
    router.push("/capex-calculator");
  }

  const yearsLeft = result ? result.due - startYear : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">When will yours need replacing?</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Year installed</span>
          <input className={input} inputMode="numeric" placeholder="e.g. 2014" value={installYear} onChange={(e) => setInstallYear(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{item.unitLabel === "per_sq_ft" ? "Square feet" : "How many"}</span>
          <input className={input} inputMode="numeric" placeholder={item.unitLabel === "per_sq_ft" ? "e.g. 1,200" : "e.g. 12"} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Replacement cost {item.unitLabel === "per_sq_ft" ? "per sq ft" : "each"}</span>
          <input className={input} inputMode="decimal" placeholder="Your cost" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      </div>

      <div className="mt-5 text-slate-700 dark:text-slate-300" aria-live="polite">
        {!result ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {installYear.trim() && !validYear
              ? `Enter a 4-digit year from 1900 to ${startYear}.`
              : "Enter the install year to see when replacement is due."}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-lg">
              <span className="font-semibold text-slate-950 dark:text-white">
                {yearsLeft < 0
                  ? `Past expected life since ${result.due}`
                  : yearsLeft === 0
                    ? `Due this year (${result.due})`
                    : `Due around ${result.due}, in ${yearsLeft} year${yearsLeft === 1 ? "" : "s"}`}
              </span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Typical range {result.low}–{result.high}, from a typical life of {item.lifeLow}–{item.lifeHigh} years.
            </p>
            {result.monthly !== null && result.neededNow !== null && (
              <p className="text-sm">
                {result.neededNow > 0 && (
                  <>
                    Budget <strong className="text-slate-950 dark:text-white">{formatMoney(result.neededNow)}</strong> this year.{" "}
                  </>
                )}
                {result.monthly > 0 && (
                  <>
                    Set aside <strong className="text-slate-950 dark:text-white">{formatMoney(result.monthly)}/month</strong> to
                    have the cash ready for the next replacement.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        <button
          type="button"
          onClick={addToForecast}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Add to my building&apos;s forecast
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Opens the free calculator with this item filled in.
        </span>
      </div>
    </div>
  );
}
