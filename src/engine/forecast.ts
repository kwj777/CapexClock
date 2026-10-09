import { endOfLifeYear, firstReplacementYear } from "./component";
import { AT_RISK_YEARS } from "./constants";
import { projectReplacements } from "./project";
import { findAtRisk } from "./risk";
import { summarizeForecast } from "./summarize";
import { assertStartYear, assertValidComponent } from "./validate";
import type {
  AssetGroup,
  Component,
  ForecastInput,
  ForecastOptions,
  ForecastResult,
  ForecastSummary,
  GroupForecast,
  NextReplacement,
  RollupTotals,
  ScenarioComparison,
  Scenario,
} from "./types";

/** The next replacement year of each component, in input order. */
export function nextReplacementYears(components: readonly Component[], startYear: number): NextReplacement[] {
  assertStartYear(startYear);
  return components.map((c) => {
    assertValidComponent(c);
    return { componentId: c.id, year: firstReplacementYear(c, startYear), overdue: endOfLifeYear(c) < startYear };
  });
}

/** projectReplacements + summarizeForecast + findAtRisk + nextReplacementYears in one call. */
export function computeForecast(input: ForecastInput): ForecastResult {
  const summary = summarizeForecast(projectReplacements(input), input);
  return {
    ...summary,
    replacements: summary.years.flatMap((y) => y.replacements),
    atRisk: findAtRisk(input.components, input.startYear, input.atRiskYears ?? AT_RISK_YEARS),
    nextReplacements: nextReplacementYears(input.components, input.startYear),
  };
}

/** A copy of the list with the given components set to `scenario`. The input is not changed. */
export function withScenario(
  components: readonly Component[],
  ids: ReadonlySet<string>,
  scenario: Scenario,
): Component[] {
  return components.map((c) => (ids.has(c.id) ? { ...c, scenario } : c));
}

/**
 * Two forecasts side by side, for "replace now vs run to failure" and similar
 * what-ifs. Both must share startYear and horizonYears. difference = modified − base.
 */
export function compareScenarios(baseInput: ForecastInput, modifiedInput: ForecastInput): ScenarioComparison {
  const base: ForecastSummary = summarizeForecast(projectReplacements(baseInput), baseInput);
  const modified: ForecastSummary = summarizeForecast(projectReplacements(modifiedInput), modifiedInput);
  if (base.startYear !== modified.startYear || base.horizonYears !== modified.horizonYears) {
    throw new RangeError("Scenarios must have the same start year and window.");
  }
  return {
    base,
    modified,
    difference: {
      neededNow: modified.neededNow - base.neededNow,
      horizonTotal: modified.horizonTotal - base.horizonTotal,
      monthlyReserve: modified.monthlyReserve - base.monthlyReserve,
      shortfallNow: modified.shortfallNow - base.shortfallNow,
    },
  };
}

/** One forecast per group, with shared options; a group's own balance and contingency rate win over the options'. */
export function forecastAssetGroups(groups: readonly AssetGroup[], options: ForecastOptions): GroupForecast[] {
  return groups.map((group) => ({
    group,
    result: computeForecast({
      ...options,
      components: group.components,
      currentReserveBalance: group.currentReserveBalance ?? options.currentReserveBalance,
      contingencyRate: group.contingencyRate ?? options.contingencyRate,
    }),
  }));
}

/** Plain sums across forecasts, in the order given. */
export function rollupForecasts(results: readonly ForecastResult[]): RollupTotals {
  let monthlyReserve = 0;
  let neededNow = 0;
  let horizonTotal = 0;
  let shortfallNow = 0;
  let atRiskCount = 0;
  for (const r of results) {
    monthlyReserve += r.monthlyReserve;
    neededNow += r.neededNow;
    horizonTotal += r.horizonTotal;
    shortfallNow += r.shortfallNow;
    atRiskCount += r.atRisk.length;
  }
  return { monthlyReserve, neededNow, horizonTotal, shortfallNow, atRiskCount };
}
