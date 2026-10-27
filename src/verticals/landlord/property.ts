import { validateComponent, type AssetGroup, type Component, type Scenario } from "@/engine";
import { landlordForecast, type LandlordForecast } from "./forecast";
import { safetyBufferOf } from "./rules";

/** The saved-property fields the forecast reads. The database's PropertyRow is assignable to it. */
export interface SavedProperty {
  readonly id: string;
  readonly name: string;
  readonly unit_count: number;
  readonly year_built: number | null;
  /** Safety buffer in percent (0, 10 or 20). Missing until the database has update 0007, which means none. */
  readonly safety_buffer?: number;
}

/** The saved-component fields the forecast reads. The database's ComponentRow is assignable to it. */
export interface SavedComponent {
  readonly id: string;
  readonly property_id: string;
  readonly category: string;
  readonly name: string;
  readonly quantity: number;
  readonly install_year: number | null;
  readonly install_year_is_estimate?: boolean;
  readonly useful_life_years: number;
  readonly replacement_cost_each: number | null;
  readonly scenario: Scenario;
}

/** Why a saved row isn't in the forecast. "invalid": a quantity, life or cost the engine refuses. */
export type LeftOutReason = "cost" | "install_year" | "cost_and_install_year" | "invalid";

/** A saved row the forecast leaves out, with what it's missing. */
export interface LeftOutComponent {
  readonly componentId: string;
  readonly name: string;
  readonly missing: LeftOutReason;
  /** Install year (or year built) plus useful life; null with no year to count from. */
  readonly endOfLifeYear: number | null;
  /** The owner chose "Replace now" for it. */
  readonly replaceNow: boolean;
}

/** "no replacement cost entered" and the like, for a list of left-out rows. */
export function leftOutReasonText(reason: LeftOutReason): string {
  switch (reason) {
    case "cost":
      return "no replacement cost entered";
    case "install_year":
      return "no install year entered";
    case "cost_and_install_year":
      return "no replacement cost or install year entered";
    case "invalid":
      return "check its quantity, life and cost";
  }
}

/**
 * Saved rows → engine components. A blank install year uses the year built and is
 * flagged as an estimate (so is one the owner marked a guess). Rows with no cost, no
 * year at all, or that the engine would refuse are left out and counted.
 */
export function assetGroupFromSaved(
  property: SavedProperty,
  rows: readonly SavedComponent[],
): { group: AssetGroup; excluded: number; leftOut: LeftOutComponent[] } {
  const components: Component[] = [];
  const leftOut: LeftOutComponent[] = [];
  for (const c of rows) {
    const installYear = c.install_year ?? property.year_built;
    const skip = (missing: LeftOutReason) =>
      leftOut.push({
        componentId: c.id,
        name: c.name,
        missing,
        endOfLifeYear: installYear === null ? null : installYear + c.useful_life_years,
        replaceNow: c.scenario === "replace_now",
      });
    if (c.replacement_cost_each === null || installYear === null) {
      skip(c.replacement_cost_each !== null ? "install_year" : installYear !== null ? "cost" : "cost_and_install_year");
      continue;
    }
    const component: Component = {
      id: c.id,
      category: c.category,
      name: c.name,
      quantity: Number(c.quantity),
      installYear,
      estimated: { installYear: c.install_year === null || c.install_year_is_estimate === true },
      usefulLifeYears: c.useful_life_years,
      replacementCostEach: Number(c.replacement_cost_each),
      scenario: c.scenario,
    };
    if (validateComponent(component).length === 0) components.push(component);
    else skip("invalid");
  }
  const buffer = safetyBufferOf(property.safety_buffer);
  return {
    group: {
      id: property.id,
      name: property.name,
      components,
      ...(buffer > 0 ? { contingencyRate: buffer / 100 } : {}),
    },
    excluded: leftOut.length,
    leftOut,
  };
}

export function forecastProperty(
  property: SavedProperty,
  rows: readonly SavedComponent[],
  currentYear: number,
): { forecast: LandlordForecast; excluded: number } {
  const { group, excluded } = assetGroupFromSaved(property, rows);
  return {
    forecast: landlordForecast(group.components, property.unit_count, currentYear, safetyBufferOf(property.safety_buffer)),
    excluded,
  };
}
