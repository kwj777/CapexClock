"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney, formatReserve } from "@/components/calculator/format";
import { sinkingFund, type PlannedExpense } from "@/lib/reserve/sinking-fund";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";

interface Row {
  id: number;
  name: string;
  cost: string;
  years: string;
}

function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

let nextId = 3;

export default function ReserveCalculator() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, name: "", cost: "", years: "" },
    { id: 2, name: "", cost: "", years: "" },
  ]);
  const [balance, setBalance] = useState("");
  const [units, setUnits] = useState("");

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const expenses: PlannedExpense[] = [];
  const problems = new Set<number>();
  for (const r of rows) {
    const cost = num(r.cost);
    const years = num(r.years);
    if (cost === null && years === null) continue;
    if (cost === null || cost < 0 || years === null || years < 0 || !Number.isInteger(years)) {
      problems.add(r.id);
      continue;
    }
    expenses.push({ cost, yearsUntilDue: years });
  }
  const unitCount = num(units);
  const result = expenses.length && problems.size === 0
    ? sinkingFund({ expenses, currentBalance: num(balance) ?? 0, units: unitCount !== null && unitCount > 0 ? unitCount : 0 })
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Upcoming expenses</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Costs in today&apos;s dollars. Use 0 years for anything due now.</p>
      <div className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="col-span-3 sm:col-span-1">
              <span className={label}>What</span>
              <input className={input} placeholder={i === 0 ? "e.g. Roof" : "e.g. Boiler"} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            </label>
            <label>
              <span className={label}>Cost</span>
              <input className={input} inputMode="decimal" placeholder="$" value={r.cost} onChange={(e) => update(r.id, { cost: e.target.value })} aria-invalid={problems.has(r.id)} />
            </label>
            <label>
              <span className={label}>Years until due</span>
              <input className={input} inputMode="numeric" value={r.years} onChange={(e) => update(r.id, { years: e.target.value })} aria-invalid={problems.has(r.id)} />
            </label>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              disabled={rows.length === 1}
              className="self-end rounded-md px-2 py-2 text-sm text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:hover:text-white"
              aria-label={`Remove ${r.name || `expense ${i + 1}`}`}
            >
              ✕
            </button>
            {problems.has(r.id) && (
              <p className="col-span-3 text-xs text-red-700 sm:col-span-4 dark:text-red-400">
                Enter a cost and a whole number of years (0 or more).
              </p>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { id: nextId++, name: "", cost: "", years: "" }])}
        className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400"
      >
        + Add expense
      </button>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <label>
          <span className={label}>Reserve balance today</span>
          <input className={input} inputMode="decimal" placeholder="$0" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
        <label>
          <span className={label}>Units</span>
          <input className={input} inputMode="numeric" placeholder="e.g. 12" value={units} onChange={(e) => setUnits(e.target.value)} />
        </label>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800" aria-live="polite">
        {result ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className={label}>Save each month</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{formatReserve(result.monthly)}</dd>
              </div>
              <div>
                <dt className={label}>Per unit</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
                  {result.perUnit === null ? "—" : formatReserve(result.perUnit)}
                </dd>
              </div>
              {result.shortfallNow > 0 && (
                <div>
                  <dt className={label}>Short right now</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">{formatMoney(result.shortfallNow)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              This is the smallest steady monthly amount that has the cash ready for every expense on time, starting from your
              current balance.
              {result.shortfallNow > 0 && " Your balance doesn't cover what's due now, so that gap needs to be funded separately."}
            </p>
          </>
        ) : problems.size > 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Fix the highlighted row to see your monthly amount.</p>
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
