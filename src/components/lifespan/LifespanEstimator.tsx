"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { formatMoney, formatReserve } from "@/components/calculator/format";
import { loadDraft, saveDraft, withLibraryItem } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { nextReplacementReserve } from "@/lib/forecast";
import { defaultLife, type LibraryComponent } from "@/lib/library/components";
import { subjectFor } from "@/lib/library/phrasing";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";

/** Null when blank; NaN when something was typed that isn't a number (e.g. "1.4k"). */
function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** "When will mine need replacing, and what should I set aside?" for one component. */
export default function LifespanEstimator({ item }: { item: LibraryComponent }) {
  const router = useRouter();
  const baseId = useId();
  const yearNoteId = `${baseId}-year-note`;
  const moneyNoteId = `${baseId}-money-note`;
  const [startYear] = useState(() => new Date().getFullYear());
  const [installYear, setInstallYear] = useState("");
  const [quantity, setQuantity] = useState(item.unitLabel === "per_building" ? "1" : "");
  const [cost, setCost] = useState("");
  // Set when the calculator already has this component, so the owner picks update or add.
  const [alreadyAdded, setAlreadyAdded] = useState(false);

  const life = defaultLife(item);
  const year = num(installYear);
  const validYear = year !== null && Number.isInteger(year) && year >= 1900 && year <= startYear;
  const qty = num(quantity);
  const each = num(cost);
  const sqFt = item.unitLabel === "per_sq_ft";

  let result: { due: number; low: number; high: number; monthly: number | null; neededNow: number | null } | null = null;
  // Why no dollar figure shows yet, once a cost has been typed, and which field it's about.
  let moneyHint: { text: string; field: "cost" | "quantity"; invalid: boolean } | null = null;
  if (validYear) {
    let monthly: number | null = null;
    let neededNow: number | null = null;
    if (each !== null && (Number.isNaN(each) || each < 0)) {
      moneyHint = { text: "Enter the cost as a plain number, like 1400.", field: "cost", invalid: true };
    } else if (each !== null && qty === null) {
      moneyHint = {
        text: sqFt ? "Enter the square feet to see a monthly amount." : "Enter how many to see a monthly amount.",
        field: "quantity",
        invalid: false,
      };
    } else if (each !== null && qty !== null && (Number.isNaN(qty) || qty <= 0)) {
      moneyHint = {
        text: sqFt ? "Enter the square feet as a number, like 1200." : "Enter how many as a number, like 12.",
        field: "quantity",
        invalid: true,
      };
    } else if (each !== null && qty !== null) {
      const r = nextReplacementReserve(
        { id: item.slug, category: item.category, name: item.name, quantity: qty, installYear: year, usefulLifeYears: life, replacementCostEach: each },
        startYear,
      );
      monthly = r.monthly;
      neededNow = r.neededNow;
    }
    result = { due: year + life, low: year + item.lifeLow, high: year + item.lifeHigh, monthly, neededNow };
  }

  function addToForecast(mode?: "add" | "update") {
    const draft = loadDraft();
    if (!mode && draft.rows.some((r) => r.librarySlug === item.slug)) {
      setAlreadyAdded(true);
      return;
    }
    saveDraft(withLibraryItem(draft, item, { installYear, quantity, costEach: cost }, mode ?? "add"));
    void track("lifespan_added_to_calculator", { component: item.slug });
    router.push("/capex-calculator");
  }

  const yearsLeft = result ? result.due - startYear : 0;
  const badYear = installYear.trim() !== "" && !validYear;
  // Points a field at the note below it, and marks it when what's typed can't be read.
  const noteFor = (field: "cost" | "quantity") =>
    moneyHint?.field === field
      ? { "aria-describedby": moneyNoteId, "aria-invalid": moneyHint.invalid || undefined }
      : {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">When will yours need replacing?</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Year installed</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder="e.g. 2014"
            value={installYear}
            aria-invalid={badYear || undefined}
            aria-describedby={badYear ? yearNoteId : undefined}
            onChange={(e) => setInstallYear(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>{item.unitLabel === "per_sq_ft" ? "Square feet" : "How many"}</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder={item.unitLabel === "per_sq_ft" ? "e.g. 1,200" : "e.g. 12"}
            value={quantity}
            {...noteFor("quantity")}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>Replacement cost {item.unitLabel === "per_sq_ft" ? "per sq ft" : "each"}</span>
          <input
            className={input}
            inputMode="decimal"
            placeholder="Quote or estimate"
            value={cost}
            {...noteFor("cost")}
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 text-slate-700 dark:text-slate-300" aria-live="polite">
        {!result ? (
          <p
            id={yearNoteId}
            className={badYear ? "text-sm text-amber-800 dark:text-amber-300" : "text-sm text-slate-500 dark:text-slate-400"}
          >
            {badYear
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
            {moneyHint && (
              <p id={moneyNoteId} className="text-sm text-amber-800 dark:text-amber-300">
                {moneyHint.text}
              </p>
            )}
            {result.monthly !== null && result.neededNow !== null && (
              <p className="text-sm">
                {result.neededNow > 0 && (
                  <>
                    Budget <strong className="text-slate-950 dark:text-white">{formatMoney(result.neededNow)}</strong> this year.{" "}
                  </>
                )}
                {result.monthly > 0 && (
                  <>
                    Set aside <strong className="text-slate-950 dark:text-white">{formatReserve(result.monthly)}/month</strong> to
                    have the cash ready for the next replacement.
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {alreadyAdded ? (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800" role="group" aria-labelledby={`${item.slug}-already`}>
          <p id={`${item.slug}-already`} className="text-sm text-slate-700 dark:text-slate-300">
            Your forecast already has {subjectFor(item).noun}. Update that row with these details, or add another?
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => addToForecast("update")}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              Update the one I have
            </button>
            <button
              type="button"
              onClick={() => addToForecast("add")}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              Add another
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => addToForecast()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Add to my building&apos;s forecast
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Opens the free calculator with this item filled in.
          </span>
        </div>
      )}
    </div>
  );
}
