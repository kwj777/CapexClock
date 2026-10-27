"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatMoney, formatReserve } from "@/components/calculator/format";
import { shownFields } from "@/components/reserve/shown-fields";
import { reserveCalculator, type ExpenseField } from "@/verticals/landlord";
import { explainResult } from "./reserve-text";
import { EXPENSES_STORAGE_KEY, keepSaved, loadSaved, parseSavedExpenses, useInBrowser } from "./reserve-storage";

const input =
  "mt-1 block w-full rounded-md border border-slate-500 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 aria-invalid:border-red-500 dark:border-slate-500 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";

interface Row {
  id: number;
  name: string;
  cost: string;
  years: string;
}

let nextId = 3;

export default function ReserveCalculator() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "", cost: "", years: "" },
    { id: 2, name: "", cost: "", years: "" },
  ]);
  const [balance, setBalance] = useState("");
  const [units, setUnits] = useState("");
  const baseId = useId();
  const balanceErrorId = `${baseId}-balance-error`;
  const unitsErrorId = `${baseId}-units-error`;
  // Fields the owner has left at least once ("<row id>:cost"); a row is only checked field by field after that.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  // The field being typed in, same keys. A row keeps room for its message while
  // the owner is in a field it's about, so the message appearing when they click
  // away never moves the button they're clicking.
  const [editing, setEditing] = useState<string | null>(null);
  // Field to focus after the next render (after removing a row).
  const focusNext = useRef<string | null>(null);

  // What was typed here last time, read once the page is in the browser. Saving
  // waits until then, so the empty first render never wipes it.
  const inBrowser = useInBrowser();
  const [restored, setRestored] = useState(false);
  if (inBrowser && !restored) {
    setRestored(true);
    const saved = loadSaved(EXPENSES_STORAGE_KEY, parseSavedExpenses);
    if (saved) {
      setRows(saved.rows.map((r) => ({ ...r, id: nextId++ })));
      setBalance(saved.balance);
      setUnits(saved.units);
    }
  }
  useEffect(() => {
    if (!restored) return;
    const typed = balance.trim() || units.trim() || rows.some((r) => r.name.trim() || r.cost.trim() || r.years.trim());
    keepSaved(EXPENSES_STORAGE_KEY, typed ? { rows: rows.map(({ name, cost, years }) => ({ name, cost, years })), balance, units } : null);
  }, [restored, rows, balance, units]);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const touch = (id: number, field: ExpenseField) => {
    setTouched((t) => (t.has(`${id}:${field}`) ? t : new Set(t).add(`${id}:${field}`)));
    setEditing(null);
  };

  function remove(id: number) {
    const i = rows.findIndex((r) => r.id === id);
    const next = rows[i + 1] ?? rows[i - 1];
    if (next) focusNext.current = `${baseId}-${next.id}-name`;
    setRows((rs) => rs.filter((x) => x.id !== id));
  }

  const { inputs, result } = reserveCalculator(rows, balance, units);
  const problems = inputs.rowProblems;
  const flagged = new Map(
    rows.map((r) => [
      r.id,
      shownFields(problems.get(r.id), new Set((["cost", "years"] as const).filter((f) => touched.has(`${r.id}:${f}`)))),
    ]),
  );

  // Screen readers hear one short sentence once typing pauses, not every figure
  // on every keystroke, and nothing until the owner changes something (same as
  // the Quick estimate tab).
  const summary = result
    ? `Save ${formatReserve(result.monthly)} a month` +
      (result.perUnit === null ? "." : `, ${formatReserve(result.perUnit)} per unit.`) +
      (result.shortfallNow > 0 ? ` You're ${formatMoney(result.shortfallNow)} short right now.` : "")
    : inputs.balanceProblem
      ? "Fix the highlighted fields to see your monthly amount."
      : problems.size > 0
        ? "Finish each expense's cost and years until due to see your monthly amount."
        : "";
  const [spoken, setSpoken] = useState("");
  const spokenSummary = useRef(summary);
  useEffect(() => {
    if (summary === spokenSummary.current) return;
    const timer = window.setTimeout(() => {
      spokenSummary.current = summary;
      setSpoken(summary);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [summary]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Upcoming expenses</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Costs in today&apos;s dollars. Use 0 years for anything due now.</p>
      {/* Phones stack each expense over two rows, so a divider keeps them apart. */}
      <div className="mt-4 divide-y divide-slate-200 sm:space-y-3 sm:divide-y-0 dark:divide-slate-800">
        {rows.map((r, i) => {
          // Row names keep each field's label unique, starting with the visible label.
          const rowName = r.name.trim() || `expense ${i + 1}`;
          const errorId = `${baseId}-${r.id}-error`;
          const problem = problems.get(r.id);
          const fields = flagged.get(r.id) ?? [];
          const roomForMessage = fields.length > 0 || (problem?.fields.some((f) => editing === `${r.id}:${f}`) ?? false);
          const flag = (field: ExpenseField) =>
            fields.includes(field) ? { "aria-invalid": true, "aria-describedby": errorId } : {};
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_1fr_auto] gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[2fr_1fr_1fr_auto] sm:py-0"
            >
              <label className="col-span-3 sm:col-span-1">
                <span className={label}>What</span>
                <input
                  id={`${baseId}-${r.id}-name`}
                  className={input}
                  placeholder={i === 0 ? "e.g. Roof" : "e.g. Boiler"}
                  value={r.name}
                  aria-label={`What, expense ${i + 1}`}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                />
              </label>
              <label>
                <span className={label}>Cost</span>
                <input
                  className={input}
                  inputMode="decimal"
                  placeholder="$"
                  value={r.cost}
                  aria-label={`Cost, ${rowName}`}
                  {...flag("cost")}
                  onChange={(e) => update(r.id, { cost: e.target.value })}
                  onFocus={() => setEditing(`${r.id}:cost`)}
                  onBlur={() => touch(r.id, "cost")}
                />
              </label>
              <label>
                <span className={label}>Years until due</span>
                <input
                  className={input}
                  inputMode="numeric"
                  placeholder="e.g. 5"
                  value={r.years}
                  aria-label={`Years until due, ${rowName}`}
                  {...flag("years")}
                  onChange={(e) => update(r.id, { years: e.target.value })}
                  onFocus={() => setEditing(`${r.id}:years`)}
                  onBlur={() => touch(r.id, "years")}
                />
              </label>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={rows.length === 1}
                className="min-h-10 min-w-10 self-end rounded-md px-2 py-2 text-sm text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white"
                aria-label={`Remove ${rowName}`}
              >
                ✕
              </button>
              {roomForMessage && (
                <p
                  id={errorId}
                  className={`col-span-3 text-xs text-red-700 sm:col-span-4 dark:text-red-400 ${fields.length > 0 ? "" : "invisible"}`}
                >
                  {problem?.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { id: nextId++, name: "", cost: "", years: "" }])}
        className="-mx-2 mt-2 rounded-md px-2 py-2 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400"
      >
        + Add expense
      </button>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <label>
          <span className={label}>Reserve balance today</span>
          <input
            className={input}
            inputMode="decimal"
            placeholder="$0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            aria-invalid={inputs.balanceProblem !== null}
            aria-describedby={inputs.balanceProblem ? balanceErrorId : undefined}
          />
        </label>
        <label>
          <span className={label}>Units</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder="e.g. 12"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            aria-invalid={inputs.unitsProblem !== null}
            aria-describedby={inputs.unitsProblem ? unitsErrorId : undefined}
          />
        </label>
        {inputs.balanceProblem && (
          <p id={balanceErrorId} className="col-span-2 text-xs text-red-700 dark:text-red-400">
            {inputs.balanceProblem}
          </p>
        )}
        {inputs.unitsProblem && (
          <p id={unitsErrorId} className="col-span-2 text-xs text-red-700 dark:text-red-400">
            {inputs.unitsProblem}
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </p>
      <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
        {result ? (
          <>
            {/* min-w-0 and wrapping keep a huge (typo-sized) amount inside its column. */}
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 [&>div]:min-w-0">
              <div>
                <dt className={label}>Save each month</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums wrap-anywhere text-slate-950 dark:text-white">{formatReserve(result.monthly)}</dd>
              </div>
              <div>
                <dt className={label}>Per unit</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums wrap-anywhere text-slate-950 dark:text-white">
                  {result.perUnit === null ? "—" : formatReserve(result.perUnit)}
                </dd>
              </div>
              {result.shortfallNow > 0 && (
                <div>
                  <dt className={label}>Short right now</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums wrap-anywhere text-red-700 dark:text-red-400">{formatMoney(result.shortfallNow)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{explainResult(result)}</p>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Want a reminder before these come due?{" "}
              <Link href="/#signup" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
                Get early access
              </Link>
              .
            </p>
          </>
        ) : inputs.balanceProblem ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Fix the highlighted fields to see your monthly amount.</p>
        ) : problems.size > 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Finish each expense&apos;s cost and years until due to see your monthly amount.</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">Enter at least one cost and when it&apos;s due to see your monthly amount.</p>
        )}
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t know your due dates?{" "}
          <Link href="/capex-calculator" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
            The CapEx calculator
          </Link>{" "}
          works them out from install years.
        </p>
      </div>
    </div>
  );
}

