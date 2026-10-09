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

/**
 * Saved rows → engine components. A blank install year uses the year built and is
 * flagged as an estimate (so is one the owner marked a guess). Rows with no cost, no
 * year at all, or that the engine would refuse are left out and counted.
 */
export function assetGroupFromSaved(
  property: SavedProperty,
  rows: readonly SavedComponent[],
): { group: AssetGroup; excluded: number } {
  const components: Component[] = [];
  for (const c of rows) {
    const installYear = c.install_year ?? property.year_built;
    if (c.replacement_cost_each === null || installYear === null) continue;
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
  }
  const buffer = safetyBufferOf(property.safety_buffer);
  return {
    group: {
      id: property.id,
      name: property.name,
      components,
      ...(buffer > 0 ? { contingencyRate: buffer / 100 } : {}),
    },
    excluded: rows.length - components.length,
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
