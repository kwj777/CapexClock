import type { ForecastSummary } from "@/engine";

/** Several components coming due in the same year: the year the reserve has to be ready for. */
export interface DueCluster {
  readonly year: number;
  /** The names of the components due that year, each name once, in the forecast's order. */
  readonly names: readonly string[];
  /** Everything due that year. Unrounded. */
  readonly total: number;
}

/**
 * The costliest year from reserveFromYear to the end of the window, when two or more
 * components come due in it; null when that year has only one (or nothing is due).
 * The first year isn't counted: it's already shown as needed now. On a tie the
 * earlier year wins, as it does for the tightest year.
 */
export function biggestDueCluster(forecast: Pick<ForecastSummary, "years" | "reserveFromYear">): DueCluster | null {
  let biggest: ForecastSummary["years"][number] | null = null;
  for (const y of forecast.years) {
    if (y.year < forecast.reserveFromYear || y.total <= 0) continue;
    if (!biggest || y.total > biggest.total) biggest = y;
  }
  if (!biggest) return null;
  // Two water heaters entered as separate rows still read as one thing coming due.
  const names = [...new Set(biggest.replacements.map((r) => r.name))];
  return names.length >= 2 ? { year: biggest.year, names, total: biggest.total } : null;
}
