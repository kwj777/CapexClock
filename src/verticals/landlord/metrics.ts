import type { ForecastSummary } from "@/engine";
import type { VerticalGroup } from "../vertical";

/** What the landlord vertical knows about one property that the engine doesn't. */
export interface LandlordFacts {
  /** Rental units (doors). 0 when unknown. Fractions are accepted, as the calculator allows them. */
  readonly unitCount: number;
}

export interface LandlordMetrics {
  /** monthlyReserve ÷ unitCount; null when the unit count is 0. Unrounded. */
  readonly monthlyReservePerUnit: number | null;
}

export interface PortfolioMetrics {
  /** Σ monthly reserve of properties with units ÷ Σ their units; null when none has units. */
  readonly perUnit: number | null;
  /** Properties with a reserve but no unit count, so left out of perUnit, in input order. */
  readonly missingUnitIds: readonly string[];
}

export function assertUnitCount(unitCount: number): void {
  if (!Number.isFinite(unitCount) || unitCount < 0) throw new RangeError("Unit count can't be negative.");
}

export function landlordMetrics(summary: Pick<ForecastSummary, "monthlyReserve">, facts: LandlordFacts): LandlordMetrics {
  assertUnitCount(facts.unitCount);
  return { monthlyReservePerUnit: facts.unitCount > 0 ? summary.monthlyReserve / facts.unitCount : null };
}

export function portfolioMetrics(groups: readonly VerticalGroup<LandlordFacts>[]): PortfolioMetrics {
  let unitMonthly = 0;
  let units = 0;
  const missingUnitIds: string[] = [];
  for (const { group, result, facts } of groups) {
    if (facts.unitCount > 0) {
      unitMonthly += result.monthlyReserve;
      units += facts.unitCount;
    } else if (result.monthlyReserve > 0) {
      missingUnitIds.push(group.id);
    }
  }
  return { perUnit: units > 0 ? unitMonthly / units : null, missingUnitIds };
}
