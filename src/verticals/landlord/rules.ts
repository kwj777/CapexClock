import type { ForecastOptions } from "@/engine";

/**
 * The landlord rules Kevin approved, passed to the engine explicitly on every
 * call (they happen to equal the engine's defaults; the landlord never relies on that).
 */
export const LANDLORD_RULES = {
  /** Years shown and totalled. */
  horizonYears: 10,
  /** The monthly reserve looks this many years ahead. */
  reserveHorizonYears: 30,
  /** At risk = past end of life or within this many years. */
  atRiskYears: 2,
  /** Today's dollars. */
  inflationRate: 0,
  /** The calculator starts from $0 saved. */
  currentReserveBalance: 0,
} as const;

/** Engine options for a landlord forecast that starts in `currentYear`. */
export function landlordOptions(currentYear: number): ForecastOptions {
  return { startYear: currentYear, ...LANDLORD_RULES };
}

/**
 * Today's at-risk display order: most urgent first, then by name in the visitor's
 * own alphabetical order (the browser's default locale), exactly as before.
 */
export function byUrgencyThenName<T extends { readonly yearsRemaining: number; readonly name: string }>(a: T, b: T): number {
  return a.yearsRemaining - b.yearsRemaining || a.name.localeCompare(b.name);
}
