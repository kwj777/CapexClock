import {
  assertForecastOptions,
  compareScenarios,
  findAtRisk,
  nextReplacementYear,
  replacementCost,
  withScenario,
  type AtRiskComponent,
  type Component,
  type ForecastSummary,
  type ScenarioFigures,
  type YearAdjustment,
} from "@/engine";
import { assertUnitCount, landlordMetrics } from "./metrics";
import { byUrgencyThenName, LANDLORD_RULES, landlordOptions } from "./rules";

/** The headline figures for one side of the comparison. */
export interface ComparisonFigures {
  /** Cash needed in the first year. */
  readonly neededNow: number;
  /** Every replacement in the 10 years shown. */
  readonly total: number;
  readonly monthlyReserve: number;
  /** Null when the unit count is zero. */
  readonly monthlyReservePerUnit: number | null;
}

/** An at-risk component the comparison can move to the first year. */
export interface CompareItem extends AtRiskComponent {
  /** Quantity × cost each, in today's dollars. */
  readonly cost: number;
  /** Past end of life or due this year: paid in the first year whether or not it is replaced now. */
  readonly paidInFirstYearEitherWay: boolean;
}

export interface ReplaceNowComparison {
  /**
   * At-risk components the comparison can move to the first year, in the at-risk
   * list's order: every one that isn't already set to replace now.
   */
  readonly items: readonly CompareItem[];
  /** At-risk components already set to replace now, so the same on both sides. */
  readonly alreadyReplacing: number;
  /** Ids of the items replaced now on the replaceNow side. */
  readonly chosen: readonly string[];
  /** The forecast as it stands, plus any emergency extra on the chosen items. */
  readonly asPlanned: ComparisonFigures;
  /** The same forecast with the chosen items set to replace now. */
  readonly replaceNow: ComparisonFigures;
  /** replaceNow − asPlanned for neededNow, horizonTotal, monthlyReserve and shortfallNow, unrounded. */
  readonly difference: ScenarioFigures;
}

export interface CompareOptions {
  /** Replace only these items now. Missing means all of them. */
  readonly only?: ReadonlySet<string>;
  /**
   * How much more a replacement costs when it waits until the item fails, in
   * percent. Added to each chosen item's next replacement on the asPlanned side
   * only. Later replacements are planned the same way on both sides, so they
   * don't get it. Missing or 0 means none.
   *
   * AWAITING KEVIN: the extra also goes on chosen items that are paid in the
   * first year either way (past end of life or due this year), because waiting
   * means running them until they break. The plan doesn't say either way, and
   * Kevin has been asked. If he wants it only on items due in the next 2 years,
   * skip those items in the extras loop below and update the "emergency" tests.
   */
  readonly emergencyPercent?: number;
}

/**
 * "What if we replace everything at risk now?": runs the forecast as it stands
 * and again on a copy with the chosen at-risk components set to replace now.
 * Items already past end of life (or due this year) land in the first year either
 * way, so without an emergency extra the difference comes from items due in the
 * next 2 years. Nothing in the input is changed.
 */
export function compareReplaceAtRiskNow(
  input: { readonly startYear: number; readonly unitCount: number; readonly components: readonly Component[] },
  options: CompareOptions = {},
): ReplaceNowComparison {
  const { startYear, unitCount, components } = input;
  // Checked in a forecast's order: window, start year, unit count, then components.
  assertForecastOptions(landlordOptions(startYear));
  assertUnitCount(unitCount);
  const byId = new Map(components.map((c) => [c.id, c]));

  const atRisk = findAtRisk(components, startYear, LANDLORD_RULES.atRiskYears).sort(byUrgencyThenName);
  const items = atRisk.filter((i) => byId.get(i.componentId)?.scenario !== "replace_now");
  const chosen = items.map((i) => i.componentId).filter((id) => options.only?.has(id) ?? true);

  const share = Math.max(0, options.emergencyPercent ?? 0) / 100;
  const adjustments: YearAdjustment[] = [];
  if (share > 0) {
    // Awaiting Kevin (see emergencyPercent): this includes items paid this year either way.
    for (const id of chosen) {
      const c = byId.get(id);
      if (!c) continue;
      // Its next replacement as planned: end of life, or this year once that's passed.
      adjustments.push({ year: nextReplacementYear(c, startYear), amount: replacementCost(c) * share });
    }
  }

  const { base, modified, difference } = compareScenarios(
    { ...landlordOptions(startYear), components, adjustments },
    { ...landlordOptions(startYear), components: withScenario(components, new Set(chosen), "replace_now") },
  );
  const figures = (s: ForecastSummary): ComparisonFigures => ({
    neededNow: s.neededNow,
    total: s.horizonTotal,
    monthlyReserve: s.monthlyReserve,
    monthlyReservePerUnit: landlordMetrics(s, { unitCount }).monthlyReservePerUnit,
  });

  return {
    items: items.map((i): CompareItem => {
      const c = byId.get(i.componentId);
      return { ...i, cost: c ? replacementCost(c) : 0, paidInFirstYearEitherWay: i.endOfLifeYear <= startYear };
    }),
    alreadyReplacing: atRisk.length - items.length,
    chosen,
    asPlanned: figures(base),
    replaceNow: figures(modified),
    difference,
  };
}
