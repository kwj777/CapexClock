import type {
  AtRiskItem,
  Forecast,
  ForecastComponent,
  ForecastInput,
  ForecastYear,
  Replacement,
} from "./types";

export const DEFAULT_WINDOW_YEARS = 10;
/** A component is "at risk" when it is this many years or fewer from end of life. */
export const AT_RISK_YEARS = 2;
/**
 * The reserve looks this many years past the current year, well beyond the
 * displayed window, so a big item due just after year 10 is still saved for
 * instead of dropping out of the number.
 */
export const RESERVE_HORIZON_YEARS = 30;

export function endOfLifeYear(component: ForecastComponent): number {
  return component.installYear + component.usefulLifeYears;
}

/** Problems that would make a component's forecast meaningless. Empty when valid. */
export function validateComponent(component: ForecastComponent): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(component.quantity) || component.quantity <= 0) {
    errors.push("Quantity must be greater than zero.");
  }
  if (!Number.isInteger(component.installYear)) {
    errors.push("Install year must be a whole year.");
  }
  if (
    !Number.isInteger(component.usefulLifeYears) ||
    component.usefulLifeYears < 1 ||
    component.usefulLifeYears > 100
  ) {
    errors.push("Useful life must be a whole number of years from 1 to 100.");
  }
  if (!Number.isFinite(component.replacementCostEach) || component.replacementCostEach < 0) {
    errors.push("Replacement cost can't be negative.");
  }
  return errors;
}

function assertValid(component: ForecastComponent): void {
  const errors = validateComponent(component);
  if (errors.length > 0) {
    throw new RangeError(`Invalid component "${component.name}": ${errors.join(" ")}`);
  }
}

/**
 * Years in [startYear, endYear] when the component is replaced.
 *
 * The first replacement is at end of life, or in startYear if end of life has
 * already passed (or the scenario is "replace_now"); later ones repeat every
 * useful-life years.
 */
export function replacementYears(
  component: ForecastComponent,
  startYear: number,
  endYear: number,
): number[] {
  assertValid(component);
  const eol = endOfLifeYear(component);
  const first =
    component.scenario === "replace_now" ? startYear : Math.max(eol, startYear);

  const years: number[] = [];
  for (let year = first; year <= endYear; year += component.usefulLifeYears) {
    years.push(year);
  }
  return years;
}

export function replacementCost(component: ForecastComponent): number {
  return component.quantity * component.replacementCostEach;
}

export function atRiskItems(
  components: ForecastComponent[],
  startYear: number,
): AtRiskItem[] {
  return components
    .map((c): AtRiskItem | null => {
      const eol = endOfLifeYear(c);
      const yearsRemaining = eol - startYear;
      if (yearsRemaining > AT_RISK_YEARS) return null;
      return {
        componentId: c.id,
        name: c.name,
        category: c.category,
        endOfLifeYear: eol,
        yearsRemaining,
        status: yearsRemaining < 0 ? "overdue" : "due_soon",
        installYearIsEstimate: c.installYearIsEstimate ?? false,
      };
    })
    .filter((item): item is AtRiskItem => item !== null)
    .sort((a, b) => a.yearsRemaining - b.yearsRemaining || a.name.localeCompare(b.name));
}

function buildYears(components: ForecastComponent[], startYear: number, count: number): ForecastYear[] {
  const endYear = startYear + count - 1;
  const years: ForecastYear[] = Array.from({ length: count }, (_, i) => ({
    year: startYear + i,
    total: 0,
    byCategory: {},
    replacements: [],
  }));

  for (const component of components) {
    const cost = replacementCost(component);
    const overdue = endOfLifeYear(component) < startYear;
    for (const year of replacementYears(component, startYear, endYear)) {
      const bucket = years[year - startYear];
      const replacement: Replacement = {
        componentId: component.id,
        name: component.name,
        category: component.category,
        year,
        cost,
        overdue: overdue && year === startYear,
        installYearIsEstimate: component.installYearIsEstimate ?? false,
      };
      bucket.replacements.push(replacement);
      bucket.total += cost;
      bucket.byCategory[component.category] =
        (bucket.byCategory[component.category] ?? 0) + cost;
    }
  }
  return years;
}

/**
 * The smallest level monthly deposit, starting from nothing today, that has the
 * cash ready for every replacement after the first year. A bill in year k of the
 * horizon (k >= 1) has 12k months of deposits behind it. First-year costs aren't
 * included: there's no time to save for them, so they're reported as needed now.
 */
export function levelMonthlyReserve(years: ForecastYear[]): number {
  return tightestPoint(years).monthly;
}

/** The level monthly deposit and the index of the earliest year that sets it (0 when nothing does). */
function tightestPoint(years: ForecastYear[]): { monthly: number; index: number } {
  let cumulative = 0;
  let monthly = 0;
  let index = 0;
  for (let k = 1; k < years.length; k++) {
    cumulative += years[k].total;
    const needed = cumulative / (k * 12);
    if (needed > monthly) {
      monthly = needed;
      index = k;
    }
  }
  return { monthly, index };
}

/**
 * Level monthly amount to have the cash ready for one component's next
 * replacement that can still be saved for (savingFor): the one at end of life,
 * or, when that's this year or overdue, the one after it. It matches the
 * forecast's reserve for a single component but has no horizon, so long-lived
 * items still get a figure. The forecast leaves out a replacement due after
 * startYear + RESERVE_HORIZON_YEARS until it comes within the horizon.
 */
export function nextReplacementReserve(
  component: ForecastComponent,
  startYear: number,
): { neededNow: number; monthly: number; savingFor: number } {
  assertValid(component);
  const cost = replacementCost(component);
  const yearsUntilDue = endOfLifeYear(component) - startYear;
  if (component.scenario === "replace_now" || yearsUntilDue <= 0) {
    return {
      neededNow: cost,
      monthly: cost / (12 * component.usefulLifeYears),
      savingFor: startYear + component.usefulLifeYears,
    };
  }
  return { neededNow: 0, monthly: cost / (12 * yearsUntilDue), savingFor: startYear + yearsUntilDue };
}

export function computeForecast(input: ForecastInput): Forecast {
  const windowYears = input.years ?? DEFAULT_WINDOW_YEARS;
  if (!Number.isInteger(windowYears) || windowYears < 1) {
    throw new RangeError("Forecast window must be a whole number of years, at least 1.");
  }
  if (!Number.isInteger(input.startYear)) {
    throw new RangeError("Start year must be a whole year.");
  }
  if (!Number.isFinite(input.unitCount) || input.unitCount < 0) {
    throw new RangeError("Unit count can't be negative.");
  }

  const startYear = input.startYear;
  // This year plus the RESERVE_HORIZON_YEARS after it.
  const horizon = buildYears(
    input.components,
    startYear,
    Math.max(windowYears, RESERVE_HORIZON_YEARS + 1),
  );
  const years = horizon.slice(0, windowYears);
  const total = years.reduce((sum, y) => sum + y.total, 0);
  const { monthly: monthlyReserve, index: tightest } = tightestPoint(horizon);
  const savingAhead = horizon.slice(windowYears, tightest + 1).flatMap((y) => y.replacements);

  return {
    startYear,
    endYear: startYear + windowYears - 1,
    years,
    total,
    neededNow: years[0].total,
    monthlyReserve,
    monthlyReservePerUnit: input.unitCount > 0 ? monthlyReserve / input.unitCount : null,
    savingAhead,
    atRisk: atRiskItems(input.components, startYear),
  };
}
