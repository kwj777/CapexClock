// FROZEN COPY of the math inside src/components/lifespan/LifespanEstimator.tsx at
// commit 94acb55 (main), copied line for line out of the component (which can't run
// outside React) so its figures can be pinned. Each block names the lines it came
// from. Do not edit: the "Today's numbers unchanged" check fails on any change here.

import { nextReplacementReserve, RESERVE_HORIZON_YEARS } from "./forecast";
import { defaultLife, type LibraryComponent } from "./library";

// LifespanEstimator.tsx lines 16-22.
/** Null when blank; NaN when something was typed that isn't a number (e.g. "1.4k"). */
function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export interface LegacyLifespanResult {
  result: {
    due: number;
    low: number;
    high: number;
    monthly: number | null;
    neededNow: number | null;
    savingFor: number | null;
  } | null;
  moneyHint: { text: string; field: "cost" | "quantity"; invalid: boolean } | null;
  yearsLeft: number;
  forecastCountsFrom: number | null;
  badYear: boolean;
}

/** The estimator's figures for what's typed, as the component works them out on each render. */
export function legacyLifespanEstimate(
  item: LibraryComponent,
  installYear: string,
  quantity: string,
  cost: string,
  startYear: number,
): LegacyLifespanResult {
  // Lines 44-50.
  const life = defaultLife(item);
  const year = num(installYear);
  const validYear = year !== null && Number.isInteger(year) && year >= 1900 && year <= startYear;
  const qty = num(quantity);
  const each = num(cost);
  const sqFt = item.unitLabel === "per_sq_ft";

  // Lines 52-90.
  let result: LegacyLifespanResult["result"] = null;
  let moneyHint: LegacyLifespanResult["moneyHint"] = null;
  if (validYear) {
    let monthly: number | null = null;
    let neededNow: number | null = null;
    let savingFor: number | null = null;
    if (each !== null && (Number.isNaN(each) || each < 0)) {
      moneyHint = { text: "Enter the cost as a plain number, like 1400.", field: "cost", invalid: true };
    } else if (each !== null && qty === null) {
      moneyHint = {
        text: sqFt ? "Enter the square feet to see a monthly amount." : "Enter how many to see a monthly amount.",
        field: "quantity",
        invalid: false,
      };
    } else if (each !== null && qty !== null && (Number.isNaN(qty) || qty <= 0)) {
      moneyHint = {
        text: sqFt ? "Enter the square feet as a number, like 1200." : "Enter how many as a number, like 12.",
        field: "quantity",
        invalid: true,
      };
    } else if (each !== null && qty !== null) {
      const r = nextReplacementReserve(
        { id: item.slug, category: item.category, name: item.name, quantity: qty, installYear: year, usefulLifeYears: life, replacementCostEach: each },
        startYear,
      );
      monthly = r.monthly;
      neededNow = r.neededNow;
      savingFor = r.savingFor;
    }
    result = { due: year + life, low: year + item.lifeLow, high: year + item.lifeHigh, monthly, neededNow, savingFor };
  }

  // Lines 102-109.
  const yearsLeft = result ? result.due - startYear : 0;
  const forecastCountsFrom =
    result?.savingFor != null && result.savingFor > startYear + RESERVE_HORIZON_YEARS
      ? result.savingFor - RESERVE_HORIZON_YEARS
      : null;
  const badYear = installYear.trim() !== "" && !validYear;
  return { result, moneyHint, yearsLeft, forecastCountsFrom, badYear };
}
