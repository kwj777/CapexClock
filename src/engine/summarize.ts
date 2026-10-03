import { inflationFactor } from "./component";
import { levelMonthlyReserve } from "./reserve";
import { resolveOptions } from "./validate";
import type { ForecastOptions, ForecastSummary, Replacement, YearSummary } from "./types";

interface Bucket {
  year: number;
  total: number;
  byCategory: Record<string, number>;
  adjustment: number;
  replacements: Replacement[];
}

/**
 * Yearly totals, the horizon total, needed now and the level monthly reserve.
 *
 * Replacements are added to their year in list order (years past the projection
 * are ignored; a year before startYear or not whole throws). Adjustments for the
 * same year are summed in list order, inflated once, and added to that year's
 * total after its replacements. The reserve runs over all projected years, so it
 * sees max(horizonYears, reserveHorizonYears + 1) years even though only the
 * horizon is returned in `years`.
 */
export function summarizeForecast(replacements: readonly Replacement[], options: ForecastOptions): ForecastSummary {
  const o = resolveOptions(options);
  const buckets: Bucket[] = Array.from({ length: o.projectionYears }, (_, i) => ({
    year: o.startYear + i,
    total: 0,
    byCategory: {},
    adjustment: 0,
    replacements: [],
  }));
  for (const r of replacements) {
    if (!Number.isInteger(r.year) || r.year < o.startYear) {
      throw new RangeError("Replacement year must be a whole year from the start year on.");
    }
    const bucket = buckets[r.year - o.startYear];
    if (!bucket) continue;
    bucket.replacements.push(r);
    bucket.total += r.cost;
    bucket.byCategory[r.category] = (bucket.byCategory[r.category] ?? 0) + r.cost;
  }
  const extra = new Map<number, number>();
  for (const a of o.adjustments) extra.set(a.year, (extra.get(a.year) ?? 0) + a.amount);
  for (const [year, amount] of extra) {
    const bucket = buckets[year - o.startYear];
    if (!bucket) continue;
    bucket.adjustment = amount * inflationFactor(o.inflationRate, year - o.startYear);
    bucket.total += bucket.adjustment;
  }

  const years: YearSummary[] = buckets.slice(0, o.horizonYears);
  const horizonTotal = years.reduce((sum, y) => sum + y.total, 0);
  const neededNow = years[0].total;
  const totals = buckets.map((b) => b.total);
  const reserve = levelMonthlyReserve(totals, o.currentReserveBalance);
  const savingAhead = buckets
    .slice(o.horizonYears, (reserve.tightestIndex ?? 0) + 1)
    .flatMap((b) => b.replacements);

  return {
    startYear: o.startYear,
    endYear: o.startYear + o.horizonYears - 1,
    reserveYearTotals: totals,
    horizonYears: o.horizonYears,
    years,
    horizonTotal,
    neededNow,
    monthlyReserve: reserve.monthly,
    reserveFromYear: o.startYear + 1,
    reserveThroughYear: o.startYear + o.projectionYears - 1,
    tightestYear: reserve.tightestIndex === null ? null : o.startYear + reserve.tightestIndex,
    currentReserveBalance: o.currentReserveBalance,
    shortfallNow: reserve.shortfallNow,
    carriedForward: reserve.carriedForward,
    savingAhead,
  };
}
