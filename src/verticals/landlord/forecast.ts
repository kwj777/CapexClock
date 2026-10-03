import { assertForecastOptions, computeForecast, type Component, type ForecastResult } from "@/engine";
import { badYearBuilt, toComponents, type RowProblem } from "./draft/components";
import type { Draft } from "./draft/model";
import { parseUnitCount } from "./draft/rows";
import { assertUnitCount, landlordMetrics, type LandlordMetrics } from "./metrics";
import { byUrgencyThenName, landlordOptions } from "./rules";

/** The engine's forecast plus the landlord's derived metrics. */
export interface LandlordForecast extends ForecastResult, LandlordMetrics {
  readonly unitCount: number;
}

/**
 * The forecast every landlord page shows: start year = the current year (passed
 * in) and LANDLORD_RULES (10 years shown, 30-year look-ahead, at risk within 2
 * years, no inflation, $0 saved). Checks in today's order: window, start year,
 * unit count, then components.
 */
export function landlordForecast(
  components: readonly Component[],
  unitCount: number,
  currentYear: number,
): LandlordForecast {
  const options = landlordOptions(currentYear);
  assertForecastOptions(options);
  assertUnitCount(unitCount);
  return withLandlordMetrics(computeForecast({ ...options, components }), unitCount);
}

/** Adds the landlord's display order and per-unit figure to an engine forecast. */
export function withLandlordMetrics(forecast: ForecastResult, unitCount: number): LandlordForecast {
  assertUnitCount(unitCount);
  return {
    ...forecast,
    atRisk: [...forecast.atRisk].sort(byUrgencyThenName),
    ...landlordMetrics(forecast, { unitCount }),
    unitCount,
  };
}

/** The calculator's form, forecast. */
export interface DraftForecast {
  readonly components: Component[];
  /** By row id; rows with a problem are left out of the forecast, never guessed. */
  readonly problems: Record<string, RowProblem>;
  /** parseUnitCount(draft.unitCount): fractions allowed, 0 when blank or unreadable. */
  readonly unitCount: number;
  readonly yearBuiltIsBad: boolean;
  readonly forecast: LandlordForecast;
}

/** The calculator's form to its forecast: rows to components, the unit count, then the forecast. */
export function forecastDraft(draft: Draft, currentYear: number): DraftForecast {
  const { components, problems } = toComponents(draft, currentYear);
  const unitCount = parseUnitCount(draft.unitCount);
  return {
    components,
    problems,
    unitCount,
    yearBuiltIsBad: badYearBuilt(draft.yearBuilt, currentYear),
    forecast: landlordForecast(components, unitCount, currentYear),
  };
}
