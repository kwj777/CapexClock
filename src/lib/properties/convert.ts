import type { Draft, DraftRow } from "@/components/calculator/draft";
import { EARLIEST_INSTALL_YEAR } from "@/components/calculator/draft";
import { computeForecast, validateComponent, type Forecast, type ForecastComponent } from "@/lib/forecast";
import type {
  ComponentRow,
  PropertyRow,
  SaveComponentInput,
  SavePropertyInput,
} from "@/lib/supabase/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function draftFromRows(property: PropertyRow, components: ComponentRow[]): Draft {
  return {
    unitCount: String(property.unit_count),
    yearBuilt: property.year_built === null ? "" : String(property.year_built),
    rows: [...components]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (c): DraftRow => ({
          id: c.id,
          librarySlug: c.library_slug,
          category: c.category,
          name: c.name,
          quantity: String(c.quantity),
          unitLabel: c.unit_label,
          installYear: c.install_year === null ? "" : String(c.install_year),
          usefulLife: String(c.useful_life_years),
          costEach: c.replacement_cost_each === null ? "" : String(c.replacement_cost_each),
          scenario: c.scenario,
        }),
      ),
  };
}

function parse(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  return cleaned === "" ? null : Number(cleaned);
}

export type SaveProblem =
  | "name"
  | "name_length"
  | "quantity"
  | "life"
  | "install_year"
  | "cost"
  | "year_built"
  | "unit_count";

// The database's limits (supabase/migrations), checked here so the owner sees
// which field to fix instead of a failed save.
export const MAX_NAME_LENGTH = 200;
export const MAX_UNIT_COUNT = 100_000;
export const MAX_QUANTITY = 1e9;
export const MAX_COST = 1e12;

export const SAVE_PROBLEM_TEXT: Record<SaveProblem, string> = {
  name: "Give every component a name.",
  name_length: `Component names can be up to ${MAX_NAME_LENGTH} characters.`,
  quantity: "Quantities must be above 0 and under 1 billion.",
  life: "Useful life must be a whole number from 1 to 100.",
  install_year: `Install years must be 4-digit years from ${EARLIEST_INSTALL_YEAR} to this year, or blank.`,
  cost: "Costs must be plain numbers like 1400, or blank.",
  year_built: `Year built must be a 4-digit year from ${EARLIEST_INSTALL_YEAR} to this year, or blank.`,
  unit_count: "Rental units must be a whole number up to 100,000.",
};

export interface SaveInput {
  property: SavePropertyInput;
  components: SaveComponentInput[];
  /** Why the draft can't be saved yet, by row id ("property" for the property fields). */
  problems: Record<string, SaveProblem>;
}

function validYear(year: number | null, currentYear: number): boolean {
  return year === null || (Number.isInteger(year) && year >= EARLIEST_INSTALL_YEAR && year <= currentYear);
}

/**
 * Turns the editor's draft into save_property arguments. Blank costs and install
 * years are allowed (the row is kept but not forecast); anything the database
 * would reject is reported instead.
 */
export function toSaveInput(
  name: string,
  draft: Draft,
  currentYear: number,
  propertyId?: string,
): SaveInput {
  const problems: Record<string, SaveProblem> = {};
  const unitCount = parse(draft.unitCount) ?? 0;
  const yearBuilt = parse(draft.yearBuilt);
  if (!Number.isInteger(unitCount) || unitCount < 0 || unitCount > MAX_UNIT_COUNT) problems.property = "unit_count";
  else if (!validYear(yearBuilt, currentYear)) problems.property = "year_built";

  const components: SaveComponentInput[] = [];
  draft.rows.forEach((row, index) => {
    const quantity = parse(row.quantity);
    const life = parse(row.usefulLife);
    const installYear = parse(row.installYear);
    const cost = parse(row.costEach);
    let problem: SaveProblem | null = null;
    if (!row.name.trim()) problem = "name";
    else if (row.name.trim().length > MAX_NAME_LENGTH) problem = "name_length";
    else if (quantity === null || !(quantity > 0 && quantity < MAX_QUANTITY)) problem = "quantity";
    else if (life === null || !Number.isInteger(life) || life < 1 || life > 100) problem = "life";
    else if (!validYear(installYear, currentYear)) problem = "install_year";
    else if (cost !== null && !(cost >= 0 && cost < MAX_COST)) problem = "cost";
    if (problem) {
      problems[row.id] = problem;
      return;
    }
    components.push({
      ...(UUID.test(row.id) ? { id: row.id } : {}),
      library_slug: row.librarySlug,
      category: row.category,
      name: row.name.trim(),
      quantity: quantity as number,
      unit_label: row.unitLabel,
      install_year: installYear,
      useful_life_years: life as number,
      replacement_cost_each: cost,
      scenario: row.scenario,
      sort_order: index,
    });
  });

  return {
    property: {
      ...(propertyId ? { id: propertyId } : {}),
      name: name.trim() || "Untitled property",
      unit_count: problems.property === "unit_count" ? 0 : unitCount,
      year_built: yearBuilt,
    },
    components,
    problems,
  };
}

/**
 * Forecast for a saved property. Rows without a cost or any install year are left
 * out, and so is any row the forecast can't use (such as a quantity that isn't a
 * finite number), so one bad row can't break the page.
 */
export function forecastForProperty(
  property: PropertyRow,
  components: ComponentRow[],
  startYear: number,
): { forecast: Forecast; excluded: number } {
  const included: ForecastComponent[] = [];
  for (const c of components) {
    const installYear = c.install_year ?? property.year_built;
    if (c.replacement_cost_each === null || installYear === null) continue;
    const component: ForecastComponent = {
      id: c.id,
      category: c.category,
      name: c.name,
      quantity: Number(c.quantity),
      installYear,
      installYearIsEstimate: c.install_year === null,
      usefulLifeYears: c.useful_life_years,
      replacementCostEach: Number(c.replacement_cost_each),
      scenario: c.scenario,
    };
    if (validateComponent(component).length === 0) included.push(component);
  }
  return {
    forecast: computeForecast({ startYear, unitCount: property.unit_count, components: included }),
    excluded: components.length - included.length,
  };
}
