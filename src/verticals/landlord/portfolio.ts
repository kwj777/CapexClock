import { assertForecastOptions, forecastAssetGroups, rollupForecasts } from "@/engine";
import { withLandlordMetrics, type LandlordForecast } from "./forecast";
import { assertUnitCount, portfolioMetrics } from "./metrics";
import { assetGroupFromSaved, type SavedComponent, type SavedProperty } from "./property";
import { landlordOptions } from "./rules";

export interface PropertySummary<P extends SavedProperty> {
  readonly property: P;
  readonly forecast: LandlordForecast;
  readonly excluded: number;
  readonly componentCount: number;
}

export interface PortfolioTotals<P extends SavedProperty> {
  /** Σ each property's monthly reserve, unrounded. */
  readonly monthly: number;
  /** Σ each property's monthly reserve rounded up to the dollar, so it equals the cards added up. */
  readonly monthlyRoundedUp: number;
  readonly neededNow: number;
  readonly atRisk: number;
  readonly perUnit: number | null;
  readonly missingUnits: readonly P[];
}

/**
 * A monthly reserve rounded up to the next dollar, so saving the amount shown never
 * leaves the fund short. The tiny allowance keeps float noise (200.0000000001) from
 * adding a dollar.
 */
export function roundUpReserve(value: number): number {
  return Math.ceil(value - 1e-6) || 0;
}

/**
 * Orders property summaries so the one that needs money first comes first: most
 * needed this year, then most items at risk, then by name.
 */
export function byNeedsMoneyFirst(a: PropertySummary<SavedProperty>, b: PropertySummary<SavedProperty>): number {
  return (
    b.forecast.neededNow - a.forecast.neededNow ||
    b.forecast.atRisk.length - a.forecast.atRisk.length ||
    a.property.name.localeCompare(b.property.name, "en-US", { numeric: true })
  );
}

/** Each saved property becomes an engine AssetGroup; the engine forecasts them all, the landlord adds per-unit figures. */
export function summarizePortfolio<P extends SavedProperty>(
  properties: readonly P[],
  components: readonly SavedComponent[],
  currentYear: number,
): { summaries: PropertySummary<P>[]; totals: PortfolioTotals<P> } {
  const options = landlordOptions(currentYear);
  assertForecastOptions(options);
  for (const p of properties) assertUnitCount(p.unit_count);
  const byProperty = new Map<string, SavedComponent[]>();
  for (const c of components) {
    const list = byProperty.get(c.property_id);
    if (list) list.push(c);
    else byProperty.set(c.property_id, [c]);
  }
  const built = properties.map((property) => {
    const own = byProperty.get(property.id) ?? [];
    return { property, own, ...assetGroupFromSaved(property, own) };
  });
  const forecasts = forecastAssetGroups(built.map((b) => b.group), options);
  const summaries = built.map(({ property, own, excluded }, i): PropertySummary<P> => ({
    property,
    forecast: withLandlordMetrics(forecasts[i].result, property.unit_count),
    excluded,
    componentCount: own.length,
  }));
  const sums = rollupForecasts(summaries.map((s) => s.forecast));
  const metrics = portfolioMetrics(
    built.map((b, i) => ({ group: b.group, result: forecasts[i].result, facts: { unitCount: b.property.unit_count } })),
  );
  const missing = new Set(metrics.missingUnitIds);
  return {
    summaries,
    totals: {
      monthly: sums.monthlyReserve,
      monthlyRoundedUp: summaries.reduce((sum, s) => sum + roundUpReserve(s.forecast.monthlyReserve), 0),
      neededNow: sums.neededNow,
      atRisk: sums.atRiskCount,
      perUnit: metrics.perUnit,
      missingUnits: properties.filter((p) => missing.has(p.id)),
    },
  };
}
