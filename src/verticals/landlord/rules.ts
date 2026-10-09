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
  /** No safety buffer unless the owner picks one (see SAFETY_BUFFERS). */
  contingencyRate: 0,
} as const;

/**
 * The safety buffer choices, in percent: extra set aside each month on top of the
 * "never run short" amount, because something always breaks early. 0 is none.
 */
export const SAFETY_BUFFERS = [0, 10, 20] as const;
export type SafetyBuffer = (typeof SAFETY_BUFFERS)[number];

/** True for one of the SAFETY_BUFFERS. */
export function isSafetyBuffer(value: unknown): value is SafetyBuffer {
  return SAFETY_BUFFERS.some((b) => b === value);
}

/** A stored buffer read back safely: anything that isn't one of the choices is none. */
export function safetyBufferOf(value: unknown): SafetyBuffer {
  return isSafetyBuffer(value) ? value : 0;
}

/**
 * Engine options for a landlord forecast that starts in `currentYear`, with an
 * optional safety buffer in percent (0, 10 or 20) on the monthly reserve.
 */
export function landlordOptions(currentYear: number, safetyBuffer: SafetyBuffer = 0): ForecastOptions {
  return { startYear: currentYear, ...LANDLORD_RULES, contingencyRate: safetyBuffer / 100 };
}

/**
 * Today's at-risk display order: most urgent first, then by name in the visitor's
 * own alphabetical order (the browser's default locale), exactly as before.
 */
export function byUrgencyThenName<T extends { readonly yearsRemaining: number; readonly name: string }>(a: T, b: T): number {
  return a.yearsRemaining - b.yearsRemaining || a.name.localeCompare(b.name);
}
