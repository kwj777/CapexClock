import type { Forecast } from "@/lib/forecast";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { forecastForProperty } from "./convert";

export interface PropertySummary {
  property: PropertyRow;
  forecast: Forecast;
  /** Components left out of the forecast (no cost, no install year, or invalid). */
  excluded: number;
  componentCount: number;
}

export interface PortfolioTotals {
  monthly: number;
  neededNow: number;
  atRisk: number;
  /**
   * Monthly reserve per unit over the properties that have a unit count, or null
   * when none do. A property without units can't be spread over another's units.
   */
  perUnit: number | null;
  /** Properties with a reserve but no unit count, so left out of perUnit. */
  missingUnits: PropertyRow[];
}

export function summarizePortfolio(
  properties: PropertyRow[],
  components: ComponentRow[],
  startYear: number,
): { summaries: PropertySummary[]; totals: PortfolioTotals } {
  const byProperty = new Map<string, ComponentRow[]>();
  for (const c of components) {
    const list = byProperty.get(c.property_id);
    if (list) list.push(c);
    else byProperty.set(c.property_id, [c]);
  }

  const summaries = properties.map((property): PropertySummary => {
    const own = byProperty.get(property.id) ?? [];
    const { forecast, excluded } = forecastForProperty(property, own, startYear);
    return { property, forecast, excluded, componentCount: own.length };
  });

  let monthly = 0;
  let neededNow = 0;
  let atRisk = 0;
  let unitMonthly = 0;
  let units = 0;
  const missingUnits: PropertyRow[] = [];
  for (const { property, forecast } of summaries) {
    monthly += forecast.monthlyReserve;
    neededNow += forecast.neededNow;
    atRisk += forecast.atRisk.length;
    if (property.unit_count > 0) {
      unitMonthly += forecast.monthlyReserve;
      units += property.unit_count;
    } else if (forecast.monthlyReserve > 0) {
      missingUnits.push(property);
    }
  }

  return {
    summaries,
    totals: {
      monthly,
      neededNow,
      atRisk,
      perUnit: units > 0 ? unitMonthly / units : null,
      missingUnits,
    },
  };
}
