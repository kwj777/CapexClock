import {
  atRiskItems,
  computeForecast,
  DEFAULT_WINDOW_YEARS,
  endOfLifeYear,
  levelMonthlyReserve,
  replacementCost,
  RESERVE_HORIZON_YEARS,
} from "./forecast";
import type { AtRiskItem, ForecastComponent, ForecastInput, ForecastYear } from "./types";

/** The headline figures for one side of the comparison. */
export interface ComparisonFigures {
  /** Cash needed in the first year. */
  neededNow: number;
  /** Every replacement in the window (10 years unless the input says otherwise). */
  total: number;
  monthlyReserve: number;
  /** Null when the unit count is zero. */
  monthlyReservePerUnit: number | null;
}

export interface ReplaceNowComparison {
  /**
   * At-risk components the comparison can move to the first year, in the at-risk
   * list's order: every one that isn't already set to replace now.
   */
  items: AtRiskItem[];
  /** At-risk components already set to replace now, so the same on both sides. */
  alreadyReplacing: number;
  /** Ids of the items replaced now on the replaceNow side. */
  chosen: string[];
  /** The forecast as it stands, plus any emergency extra on the chosen items. */
  asPlanned: ComparisonFigures;
  /** The same forecast with the chosen items set to replace now. */
  replaceNow: ComparisonFigures;
}

export interface CompareOptions {
  /** Replace only these items now. Missing means all of them. */
  only?: ReadonlySet<string>;
  /**
   * How much more a replacement costs when it waits until the item fails, in
   * percent. Added to each chosen item's next replacement on the asPlanned side
   * only. Later replacements are planned the same way on both sides, so they
   * don't get it. Missing or 0 means none.
   */
  emergencyPercent?: number;
}

/**
 * "What if we replace everything at risk now?": runs the forecast as it stands
 * and again on a copy with the chosen at-risk components set to replace now.
 * Items already past end of life (or due this year) land in the first year either
 * way, so without an emergency extra the difference comes from items due in the
 * next 2 years. Nothing in the input is changed.
 */
export function compareReplaceNow(input: ForecastInput, options: CompareOptions = {}): ReplaceNowComparison {
  const { startYear, unitCount, components } = input;
  const windowYears = input.years ?? DEFAULT_WINDOW_YEARS;
  // The whole horizon the reserve looks at, so an emergency extra can be added
  // to its year before the reserve is worked out.
  const years = Math.max(windowYears, RESERVE_HORIZON_YEARS + 1);
  const byId = new Map(components.map((c) => [c.id, c]));

  const atRisk = atRiskItems(components, startYear);
  const items = atRisk.filter((i) => byId.get(i.componentId)?.scenario !== "replace_now");
  const chosen = items.map((i) => i.componentId).filter((id) => options.only?.has(id) ?? true);
  const chosenSet = new Set(chosen);

  const asPlanned = computeForecast({ ...input, years });
  const replaced = computeForecast({
    ...input,
    years,
    components: components.map((c): ForecastComponent => (chosenSet.has(c.id) ? { ...c, scenario: "replace_now" } : c)),
  });

  const share = Math.max(0, options.emergencyPercent ?? 0) / 100;
  const extras = new Map<number, number>();
  if (share > 0) {
    for (const id of chosen) {
      const c = byId.get(id);
      if (!c) continue;
      // Its next replacement as planned: end of life, or this year once that's passed.
      const index = Math.max(endOfLifeYear(c), startYear) - startYear;
      extras.set(index, (extras.get(index) ?? 0) + replacementCost(c) * share);
    }
  }

  return {
    items,
    alreadyReplacing: atRisk.length - items.length,
    chosen,
    asPlanned: figures(withExtras(asPlanned.years, extras), windowYears, unitCount),
    replaceNow: figures(replaced.years, windowYears, unitCount),
  };
}

function withExtras(years: ForecastYear[], extras: ReadonlyMap<number, number>): ForecastYear[] {
  if (extras.size === 0) return years;
  return years.map((y, i) => {
    const extra = extras.get(i);
    return extra ? { ...y, total: y.total + extra } : y;
  });
}

function figures(years: ForecastYear[], windowYears: number, unitCount: number): ComparisonFigures {
  const monthlyReserve = levelMonthlyReserve(years);
  return {
    neededNow: years[0].total,
    total: years.slice(0, windowYears).reduce((sum, y) => sum + y.total, 0),
    monthlyReserve,
    monthlyReservePerUnit: unitCount > 0 ? monthlyReserve / unitCount : null,
  };
}
