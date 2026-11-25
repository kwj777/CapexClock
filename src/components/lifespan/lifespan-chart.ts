import { formatCostRange } from "@/components/calculator/format";
import {
  buildingCostOf,
  TYPICAL_COST_SOURCES,
  typicalCostFor,
  type CostSource,
  type LibraryComponent,
  type TypicalCost,
} from "@/verticals/landlord";

/** A typical replacement cost as the lifespan chart shows it. */
export interface ChartCost {
  /** "$800–$2,300" */
  range: string;
  /** What the range is for: "per apartment", "per sq ft", or "per sq ft of roof, old shingles removed". */
  per: string;
  sources: readonly CostSource[];
}

/** One library item in the lifespan chart, ready to draw. Plain data, so the page can hand it to the browser. */
export interface LifespanChartRow {
  slug: string;
  name: string;
  category: string;
  lifeLow: number;
  lifeHigh: number;
  /** Null when there's no typical cost that means the same as the item's unit. */
  cost: ChartCost | null;
}

/**
 * The typical cost beside a library item, worded as the calculator words its
 * hints. Items in each apartment and per sq ft get their typical cost while it
 * means the same as the item's unit (typicalCostFor, asked for a new row as the
 * lifespan pages ask). Building-wide items get the price that doesn't depend on
 * the building's size (buildingCostOf): their per-apartment typical cost is a
 * 12-unit building's roof or boiler shared out, which no other building matches.
 * Null for anything else, such as a cost blanked or edited in the dashboard so
 * the building price no longer matches it.
 */
function chartCost(item: LibraryComponent, typical: TypicalCost | undefined): ChartCost | null {
  const sources = TYPICAL_COST_SOURCES.get(item.slug) ?? [];
  const cost = typicalCostFor({ unitLabel: item.unitLabel, quantity: "", followsUnitCount: true }, item, typical);
  if (cost) {
    return { range: formatCostRange(cost.low, cost.high), per: item.unitLabel === "per_sq_ft" ? "per sq ft" : "per apartment", sources };
  }
  const building = item.unitLabel === "per_building" ? buildingCostOf(item.slug, typical) : null;
  return building ? { range: formatCostRange(building.low, building.high), per: building.what, sources } : null;
}

/** The chart's rows in library order, each with its typical cost (see chartCost). */
export function lifespanChartRows(library: readonly LibraryComponent[], typicalCosts: readonly TypicalCost[]): LifespanChartRow[] {
  return library.map((item) => ({
    slug: item.slug,
    name: item.name,
    category: item.category,
    lifeLow: item.lifeLow,
    lifeHigh: item.lifeHigh,
    cost: chartCost(item, typicalCosts.find((c) => c.slug === item.slug)),
  }));
}

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
