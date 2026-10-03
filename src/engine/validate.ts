import {
  AT_RISK_YEARS,
  DEFAULT_HORIZON_YEARS,
  DEFAULT_RESERVE_HORIZON_YEARS,
  MAX_HORIZON_YEARS,
  MAX_INFLATION_RATE,
} from "./constants";
import type { Component, ForecastOptions, YearAdjustment } from "./types";

/** Problems that would make a component's forecast meaningless, in a fixed order. Empty when valid. */
export function validateComponent(component: Component): string[] {
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

export function assertValidComponent(component: Component): void {
  const errors = validateComponent(component);
  if (errors.length > 0) {
    throw new RangeError(`Invalid component "${component.name}": ${errors.join(" ")}`);
  }
}

export function assertStartYear(year: number): void {
  if (!Number.isInteger(year)) throw new RangeError("Start year must be a whole year.");
}

export function assertBalance(balance: number): void {
  if (!Number.isFinite(balance) || balance < 0) {
    throw new RangeError("Current reserve balance must be a dollar amount of 0 or more.");
  }
}

export function assertInflationRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_INFLATION_RATE) {
    throw new RangeError("Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%.");
  }
}

/** The at-risk window: a whole number of years from 0 to MAX_HORIZON_YEARS. */
export function assertAtRiskYears(windowYears: number): void {
  if (!Number.isInteger(windowYears) || windowYears < 0 || windowYears > MAX_HORIZON_YEARS) {
    throw new RangeError(`At-risk window must be a whole number of years from 0 to ${MAX_HORIZON_YEARS}.`);
  }
}

function assertAdjustment(a: YearAdjustment, startYear: number): void {
  if (!Number.isInteger(a.year) || a.year < startYear || !(a.amount >= 0)) {
    throw new RangeError("An adjustment needs a whole year from the start year on and an amount of 0 or more.");
  }
}

/** ForecastOptions with every default filled in. */
export interface ResolvedOptions {
  readonly startYear: number;
  readonly horizonYears: number;
  readonly reserveHorizonYears: number;
  readonly inflationRate: number;
  readonly currentReserveBalance: number;
  readonly adjustments: readonly YearAdjustment[];
  /** max(horizonYears, reserveHorizonYears + 1): the years built, from startYear. */
  readonly projectionYears: number;
  readonly atRiskYears: number;
}

/**
 * Checks the options in a fixed order (horizon, reserve horizon, start year,
 * inflation, balance, adjustments, at-risk window) and throws a RangeError for the
 * first problem.
 */
export function resolveOptions(options: ForecastOptions): ResolvedOptions {
  const horizonYears = options.horizonYears ?? DEFAULT_HORIZON_YEARS;
  if (!Number.isInteger(horizonYears) || horizonYears < 1) {
    throw new RangeError("Forecast window must be a whole number of years, at least 1.");
  }
  if (horizonYears > MAX_HORIZON_YEARS) {
    throw new RangeError(`Forecast window can't be more than ${MAX_HORIZON_YEARS} years.`);
  }
  const reserveHorizonYears = options.reserveHorizonYears ?? DEFAULT_RESERVE_HORIZON_YEARS;
  if (!Number.isInteger(reserveHorizonYears) || reserveHorizonYears < 0 || reserveHorizonYears > MAX_HORIZON_YEARS) {
    throw new RangeError(`Reserve horizon must be a whole number of years from 0 to ${MAX_HORIZON_YEARS}.`);
  }
  assertStartYear(options.startYear);
  const inflationRate = options.inflationRate ?? 0;
  assertInflationRate(inflationRate);
  const currentReserveBalance = options.currentReserveBalance ?? 0;
  assertBalance(currentReserveBalance);
  const adjustments = options.adjustments ?? [];
  for (const a of adjustments) assertAdjustment(a, options.startYear);
  const atRiskYears = options.atRiskYears ?? AT_RISK_YEARS;
  assertAtRiskYears(atRiskYears);
  return {
    startYear: options.startYear,
    horizonYears,
    reserveHorizonYears,
    inflationRate,
    currentReserveBalance,
    adjustments,
    projectionYears: Math.max(horizonYears, reserveHorizonYears + 1),
    atRiskYears,
  };
}

/** Throws the first problem with the options, exactly as a forecast would. For callers that check their own inputs in between. */
export function assertForecastOptions(options: ForecastOptions): void {
  resolveOptions(options);
}
