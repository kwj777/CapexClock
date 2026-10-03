import { endOfLifeYear, estimateFlags, firstReplacementYear, inflationFactor, replacementCost } from "./component";
import { assertValidComponent, resolveOptions } from "./validate";
import type { ForecastInput, Replacement } from "./types";

/**
 * Every replacement from startYear through the last projected year,
 * max(horizonYears, reserveHorizonYears + 1) years in all, including repeat
 * cycles. The first replacement is in startYear for "replace_now", otherwise at
 * end of life or in startYear once that has passed; later ones follow every
 * usefulLifeYears. Sorted by year, then component input order. Throws a
 * RangeError for bad options, then for the first invalid component.
 */
export function projectReplacements(input: ForecastInput): Replacement[] {
  const o = resolveOptions(input);
  const lastYear = o.startYear + o.projectionYears - 1;
  const out: Replacement[] = [];
  for (const component of input.components) {
    assertValidComponent(component);
    const baseCost = replacementCost(component);
    const overdue = endOfLifeYear(component) < o.startYear;
    const estimated = estimateFlags(component);
    for (
      let year = firstReplacementYear(component, o.startYear);
      year <= lastYear;
      year += component.usefulLifeYears
    ) {
      out.push({
        componentId: component.id,
        name: component.name,
        category: component.category,
        year,
        baseCost,
        cost: baseCost * inflationFactor(o.inflationRate, year - o.startYear),
        overdue: overdue && year === o.startYear,
        estimated,
      });
    }
  }
  // Array.prototype.sort is stable, so each year keeps component input order.
  return out.sort((a, b) => a.year - b.year);
}
