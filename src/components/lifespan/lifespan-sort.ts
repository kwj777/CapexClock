import type { LifespanChartRow } from "./lifespan-chart";

// Sorting for the lifespan chart, kept apart from lifespan-chart.ts. That file
// builds the rows on the server from the landlord vertical's costs, and anything
// the chart's browser script imports is sent to the page with everything it
// imports in turn. Importing the sort from there put the calculator's money
// formatting and forecast code on /lifespan, which never runs any of it.

/** The columns the chart sorts by. Cost doesn't sort: per apartment, per sq ft and per building can't be compared. */
export type LifespanSortKey = "name" | "category" | "life";

/** A sort as aria-sort words it: ascending is A to Z, or shortest life first. */
export interface LifespanSort {
  key: LifespanSortKey;
  direction: "ascending" | "descending";
}

const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });

const COMPARE: Record<LifespanSortKey, (a: LifespanChartRow, b: LifespanChartRow) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  category: (a, b) => collator.compare(a.category, b.category),
  // By the short end of the range, the number read first, then the long end.
  life: (a, b) => a.lifeLow - b.lifeLow || a.lifeHigh - b.lifeHigh,
};

/**
 * The rows in the chosen order, or as given (library order, grouped by category)
 * before a column is chosen. Ties keep library order either way round, so
 * flipping a sort doesn't shuffle components with the same life.
 */
export function sortLifespanRows(rows: readonly LifespanChartRow[], sort: LifespanSort | null): LifespanChartRow[] {
  if (!sort) return [...rows];
  const sign = sort.direction === "ascending" ? 1 : -1;
  const compare = COMPARE[sort.key];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sign * compare(a.row, b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The sort after a column heading is chosen: ascending first, then flipping each time it's chosen again. */
export function nextLifespanSort(current: LifespanSort | null, key: LifespanSortKey): LifespanSort {
  return { key, direction: current?.key === key && current.direction === "ascending" ? "descending" : "ascending" };
}
