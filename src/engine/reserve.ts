import { endOfLifeYear, inflationFactor, replacementCost } from "./component";
import { MAX_YEARS_UNTIL_DUE } from "./constants";
import { assertBalance, assertInflationRate, assertStartYear, assertValidComponent } from "./validate";
import type {
  Component,
  ExpensePlan,
  FundingYear,
  LevelReserve,
  PlannedExpense,
  SingleComponentReserve,
} from "./types";

function assertTotals(yearTotals: readonly number[]): void {
  // !(t >= 0) refuses NaN and negatives. +Infinity (finite inputs whose sum overflows)
  // passes through, as it always has: the page shows "$∞" rather than crashing.
  if (yearTotals.some((t) => !(t >= 0))) {
    throw new RangeError("Year totals must be amounts of 0 or more.");
  }
}

/**
 * The smallest level monthly deposit that never runs short.
 *
 * yearTotals[0] is the first year (paid now, from the balance), yearTotals[k] is
 * due k years later. With B = currentReserveBalance:
 *   shortfallNow   = max(0, T0 − B)
 *   carriedForward = A = max(0, B − T0)
 *   monthly        = max(0, max over k = 1..n of (T1 + … + Tk − A) / (12k))
 * so that A + 12k·monthly ≥ T1 + … + Tk for every k. tightestIndex is the
 * smallest k that reaches the maximum (null when monthly is 0). With B = 0 this
 * is exactly the reserve the app has always shown.
 */
export function levelMonthlyReserve(yearTotals: readonly number[], currentReserveBalance = 0): LevelReserve {
  assertTotals(yearTotals);
  assertBalance(currentReserveBalance);
  const first = yearTotals[0] ?? 0;
  const shortfallNow = Math.max(0, first - currentReserveBalance);
  const carriedForward = Math.max(0, currentReserveBalance - first);
  let cumulative = 0;
  let monthly = 0;
  let tightestIndex: number | null = null;
  for (let k = 1; k < yearTotals.length; k++) {
    cumulative += yearTotals[k];
    const needed = (cumulative - carriedForward) / (12 * k);
    if (needed > monthly) {
      monthly = needed;
      tightestIndex = k;
    }
  }
  return { monthly, tightestIndex, shortfallNow, carriedForward };
}

/** Year-by-year balance when `monthly` is deposited and yearTotals[k] is spent in year k, from k = 1. */
export function fundingSchedule(
  yearTotals: readonly number[],
  monthly: number,
  openingBalance: number,
): FundingYear[] {
  const schedule: FundingYear[] = [];
  let running = openingBalance;
  for (let k = 1; k < yearTotals.length; k++) {
    const deposits = monthly * 12;
    const spent = yearTotals[k];
    running += deposits - spent;
    schedule.push({ yearsFromStart: k, deposits, spent, endBalance: running });
  }
  return schedule;
}

/**
 * Level monthly deposit for lump sums due whole years from now (the reserve
 * calculator). Anything due now is paid from the balance first; what is left
 * counts toward later expenses. Throws when any row is more than
 * MAX_YEARS_UNTIL_DUE years out, before unusable rows are dropped.
 */
export function planExpenses(expenses: readonly PlannedExpense[], currentReserveBalance = 0): ExpensePlan {
  if (expenses.some((e) => e.yearsUntilDue > MAX_YEARS_UNTIL_DUE)) {
    throw new RangeError(`Years until due can't be more than ${MAX_YEARS_UNTIL_DUE}.`);
  }
  assertBalance(currentReserveBalance);
  const usable = expenses.filter((e) => e.cost > 0 && Number.isFinite(e.cost) && e.yearsUntilDue >= 0);
  const last = usable.reduce((max, e) => Math.max(max, Math.floor(e.yearsUntilDue)), 0);
  const totals = new Array<number>(last + 1).fill(0);
  for (const e of usable) totals[Math.floor(e.yearsUntilDue)] += e.cost;
  const reserve = levelMonthlyReserve(totals, currentReserveBalance);
  return {
    monthly: reserve.monthly,
    shortfallNow: reserve.shortfallNow,
    carriedForward: reserve.carriedForward,
    total: usable.reduce((sum, e) => sum + e.cost, 0),
    schedule: fundingSchedule(totals, reserve.monthly, reserve.carriedForward),
  };
}

/**
 * One component's level monthly amount for its next replacement that can still be
 * saved for, with no horizon cap (lifespan pages). With n = years until that
 * replacement and f = (1 + inflationRate)^n:
 *   replace_now, or end of life ≤ startYear: neededNow = cost, n = usefulLifeYears
 *   otherwise:                                neededNow = 0,    n = endOfLife − startYear
 *   monthly = cost × f / (12n), savingFor = startYear + n
 */
export function nextReplacementReserve(
  component: Component,
  startYear: number,
  options: { readonly inflationRate?: number } = {},
): SingleComponentReserve {
  assertValidComponent(component);
  assertStartYear(startYear);
  const rate = options.inflationRate ?? 0;
  assertInflationRate(rate);
  const cost = replacementCost(component);
  const yearsUntilDue = endOfLifeYear(component) - startYear;
  if (component.scenario === "replace_now" || yearsUntilDue <= 0) {
    const n = component.usefulLifeYears;
    return { neededNow: cost, monthly: (cost * inflationFactor(rate, n)) / (12 * n), savingFor: startYear + n };
  }
  return {
    neededNow: 0,
    monthly: (cost * inflationFactor(rate, yearsUntilDue)) / (12 * yearsUntilDue),
    savingFor: startYear + yearsUntilDue,
  };
}
