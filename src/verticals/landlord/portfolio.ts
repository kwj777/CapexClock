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
  readonly monthly: number;
  readonly neededNow: number;
  readonly atRisk: number;
  readonly perUnit: number | null;
  readonly missingUnits: readonly P[];
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
      neededNow: sums.neededNow,
      atRisk: sums.atRiskCount,
      perUnit: metrics.perUnit,
      missingUnits: properties.filter((p) => missing.has(p.id)),
    },
  };
}
