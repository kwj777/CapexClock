"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { loadDraft, saveArrival, saveDraft } from "@/components/calculator/draft-storage";
import { formatCostRange, formatMoney, formatReserve } from "@/components/calculator/format";
import { track } from "@/lib/analytics";
import {
  EARLIEST_INSTALL_YEAR,
  LANDLORD_RULES,
  lifespanEstimate,
  readNumber,
  subjectFor,
  typicalCostFor,
  withLibraryItem,
  type LibraryComponent,
  type TypicalCost,
} from "@/verticals/landlord";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";

/** "Typical $2,500–$5,000 per apartment, use your quote", worded as the calculator words its hint. */
function costHintFor(item: LibraryComponent, typical: TypicalCost | undefined): string | null {
  // Asked the calculator's way for a new row: per apartment or per sq ft. Building-wide
  // items get none, since their typical cost is a 12-unit building's shared out.
  const cost = typicalCostFor({ unitLabel: item.unitLabel, quantity: "", followsUnitCount: true }, item, typical);
  if (!cost) return null;
  return `Typical ${formatCostRange(cost.low, cost.high)} ${item.unitLabel === "per_sq_ft" ? "per sq ft" : "per apartment"}, use your quote`;
}

/** "When will mine need replacing, and what should I set aside?" for one component. */
export default function LifespanEstimator({ item, typical }: { item: LibraryComponent; typical?: TypicalCost }) {
  const router = useRouter();
  const baseId = useId();
  const yearNoteId = `${baseId}-year-note`;
  const moneyNoteId = `${baseId}-money-note`;
  const costHintId = `${baseId}-cost-hint`;
  const costField = useRef<HTMLInputElement>(null);
  const sqFt = item.unitLabel === "per_sq_ft";
  const [startYear] = useState(() => new Date().getFullYear());
  const [installYear, setInstallYear] = useState("");
  const [quantity, setQuantity] = useState(item.unitLabel === "per_building" ? "1" : "");
  const [cost, setCost] = useState("");
  // Set when the calculator already has this component, so the owner picks update or add.
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const alreadyPrompt = useRef<HTMLParagraphElement>(null);

  // The prompt takes the place of the button that was pressed, so move focus to
  // it: screen readers read the question, and Tab goes on to its buttons.
  useEffect(() => {
    if (alreadyAdded) alreadyPrompt.current?.focus();
  }, [alreadyAdded]);

  const { result, moneyHint, badYear } = lifespanEstimate({ item, installYear, quantity, costEach: cost, currentYear: startYear });

  function addToForecast(mode?: "add" | "update") {
    const draft = loadDraft();
    if (!mode && draft.rows.some((r) => r.librarySlug === item.slug)) {
      setAlreadyAdded(true);
      return;
    }
    const next = withLibraryItem(draft, item, { installYear, quantity, costEach: cost }, mode ?? "add");
    saveDraft(next);
    // The row it went into: the one updated, or the new last row.
    const row = mode === "update" ? next.rows.find((r) => r.librarySlug === item.slug) : next.rows[next.rows.length - 1];
    if (row) saveArrival({ rowId: row.id, name: `your ${subjectFor(item).noun.replace(/^an? /, "")}` });
    void track("lifespan_added_to_calculator", { component: item.slug });
    router.push("/capex-calculator");
  }

  // Points a field at the note below it, and marks it when what's typed can't be read.
  const noteFor = (field: "cost" | "quantity") =>
    moneyHint?.field === field
      ? { "aria-describedby": moneyNoteId, "aria-invalid": moneyHint.invalid || undefined }
      : {};
  const costHint = costHintFor(item, typical);
  const costNote = noteFor("cost");
  const costDescribedBy = [costHint ? costHintId : "", costNote["aria-describedby"] ?? ""].filter(Boolean).join(" ") || undefined;
  // Flooring is counted across the building: 800 sq ft in each of 12 apartments. A
  // parking lot at 500 sq ft each (see typical-costs.md).
  const sqFtExample = item.category === "Site" ? "e.g. 6,000" : "e.g. 9,600";
  const count = readNumber(quantity)?.toLocaleString("en-US") ?? "";

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
          <span className={label}>{sqFt ? "Square feet, whole building" : "How many"}</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder={sqFt ? sqFtExample : "e.g. 12"}
            value={quantity}
            {...noteFor("quantity")}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>Replacement cost {sqFt ? "per sq ft" : "each"}</span>
          <input
            ref={costField}
            className={input}
            inputMode="decimal"
            placeholder="Quote or estimate"
            value={cost}
            aria-invalid={costNote["aria-invalid"]}
            aria-describedby={costDescribedBy}
            onChange={(e) => setCost(e.target.value)}
          />
          {costHint && (
            <span id={costHintId} className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              {costHint}
            </span>
          )}
        </label>
      </div>

      <div className="mt-5 text-slate-700 dark:text-slate-300" aria-live="polite">
        {!result ? (
          <p
            id={yearNoteId}
            className={badYear ? "text-sm text-amber-800 dark:text-amber-300" : "text-sm text-slate-500 dark:text-slate-400"}
          >
            {badYear
              ? `Enter a 4-digit year from ${EARLIEST_INSTALL_YEAR} to ${startYear}.`
              : "Enter the install year to see when replacement is due."}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-lg">
              <span
                className={
                  result.yearsLeft < 0
                    ? "font-semibold text-amber-800 dark:text-amber-300"
                    : "font-semibold text-slate-950 dark:text-white"
                }
              >
                {result.yearsLeft < 0
                  ? `Past expected life since ${result.due}`
                  : result.yearsLeft === 0
                    ? `Due this year (${result.due})`
                    : `Due around ${result.due}, in ${result.yearsLeft} year${result.yearsLeft === 1 ? "" : "s"}`}
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
            {result.monthly === null && !moneyHint && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => costField.current?.focus()}
                  className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  Add a replacement cost
                </button>{" "}
                above to see how much to set aside each month.
              </p>
            )}
            {result.monthly !== null && result.neededNow !== null && (
              <div className="space-y-2 text-sm">
                {result.neededNow > 0 && (
                  <p>
                    Replace now: budget <strong className="text-slate-950 dark:text-white">{formatMoney(result.neededNow)}</strong>{" "}
                    this year.
                  </p>
                )}
                {result.monthly > 0 && (
                  <p>
                    {result.neededNow > 0 ? (
                      <>
                        After that, set aside{" "}
                        <strong className="text-slate-950 dark:text-white">{formatReserve(result.monthly)}/month</strong> so the
                        next replacement (around {result.savingFor}) is paid for.
                      </>
                    ) : (
                      <>
                        Set aside <strong className="text-slate-950 dark:text-white">{formatReserve(result.monthly)}/month</strong>{" "}
                        to have the cash ready for the next replacement.
                      </>
                    )}
                    {result.forecastCountsFrom !== null && (
                      <>
                        {" "}
                        The full calculator only saves for replacements due in the next{" "}
                        {LANDLORD_RULES.reserveHorizonYears} years, so it won&apos;t include this one in your monthly amount
                        until {result.forecastCountsFrom}.
                      </>
                    )}
                  </p>
                )}
                {result.spreadMonthly !== null && result.spreadMonthly > 0 && (
                  <p>
                    {sqFt ? `This assumes all ${count} sq ft is replaced` : `This assumes all ${count} are done`}{" "}
                    {result.neededNow > 0 ? "this year" : `in ${result.savingFor}`}. If you{" "}
                    {sqFt ? "replace it apartment by apartment" : "redo them"} as tenants move out, plan on about{" "}
                    <strong className="text-slate-950 dark:text-white">{formatReserve(result.spreadMonthly)}/month</strong>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {alreadyAdded ? (
        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800" role="group" aria-labelledby={`${item.slug}-already`}>
          <p
            ref={alreadyPrompt}
            id={`${item.slug}-already`}
            tabIndex={-1}
            className="text-sm text-slate-700 focus:outline-none dark:text-slate-300"
          >
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
