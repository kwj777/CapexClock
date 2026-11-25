"use client";

import Link from "next/link";
import { useState } from "react";
import { CostSources } from "@/components/CostSources";
import {
  nextLifespanSort,
  sortLifespanRows,
  type LifespanChartRow,
  type LifespanSort,
  type LifespanSortKey,
} from "./lifespan-chart";

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";
const headCell = "py-2 pr-3 align-bottom text-xs font-medium text-slate-600 dark:text-slate-400";
const cell = "py-2.5 pr-3 align-top";

/** ▲ on a column sorted ascending, ▼ descending, and a faint ▲▼ on the columns that aren't sorted. */
function SortIcon({ direction }: { direction: LifespanSort["direction"] | null }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 14"
      fill="currentColor"
      className={`h-3.5 w-2.5 shrink-0 ${direction ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
    >
      {direction !== "descending" && <path d="M5 1l4 4.5H1z" />}
      {direction !== "ascending" && <path d="M5 13L1 8.5h8z" />}
    </svg>
  );
}

/**
 * Every library item's typical life and replacement cost in one table, sorted
 * by component, category or life with the buttons in the column headings. The
 * page draws it in library order (grouped by category), so it reads the same
 * before the page's script runs. Narrow screens show the category under each
 * name instead of in its own column.
 */
export default function LifespanChart({ rows }: { rows: LifespanChartRow[] }) {
  const [sort, setSort] = useState<LifespanSort | null>(null);
  const shown = sortLifespanRows(rows, sort);

  const heading = (key: LifespanSortKey, label: string, className = "") => {
    const direction = sort?.key === key ? sort.direction : null;
    return (
      <th scope="col" aria-sort={direction ?? undefined} className={`${headCell} ${className}`}>
        <button
          type="button"
          onClick={() => setSort((current) => nextLifespanSort(current, key))}
          className="inline-flex items-center gap-1 rounded-sm text-left font-medium hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) dark:hover:text-white"
        >
          {label}
          <SortIcon direction={direction} />
        </button>
      </th>
    );
  };

  return (
    // Scrolls sideways rather than pushing the page wide at large text sizes.
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Typical life and replacement cost of each building component. The buttons in the column headings sort the
          table.
        </caption>
        <thead>
          <tr className="border-b border-slate-300 dark:border-slate-700">
            {heading("name", "Component")}
            {heading("category", "Category", "hidden sm:table-cell")}
            {heading("life", "Typical life")}
            <th scope="col" className={`${headCell} pr-0`}>
              Replacement cost
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {shown.map((row) => (
            <tr key={row.slug}>
              <th scope="row" className={`${cell} text-left font-normal`}>
                <Link href={`/lifespan/${row.slug}`} className={`text-base ${link}`}>
                  {row.name}
                </Link>
                <span className="mt-0.5 block text-xs text-slate-500 sm:hidden dark:text-slate-400">{row.category}</span>
              </th>
              <td className={`${cell} hidden text-slate-600 sm:table-cell dark:text-slate-300`}>{row.category}</td>
              <td className={`${cell} whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300`}>
                {row.lifeLow}–{row.lifeHigh} years
              </td>
              <td className={`${cell} pr-0`}>
                {row.cost ? (
                  <>
                    <span className="whitespace-nowrap tabular-nums text-slate-900 dark:text-white">{row.cost.range}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{row.cost.per}</span>
                    <CostSources sources={row.cost.sources} />
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                      —
                    </span>
                    <span className="sr-only">No typical cost listed</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
