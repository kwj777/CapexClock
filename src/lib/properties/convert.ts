import type {
  ComponentRow,
  PropertyRow,
  SaveComponentInput,
  SavePropertyInput,
} from "@/lib/supabase/database.types";
import {
  EARLIEST_INSTALL_YEAR,
  EARLIEST_YEAR_BUILT,
  MAX_NOTES_LENGTH,
  type Draft,
  type DraftRow,
  type RowField,
} from "@/verticals/landlord";

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
          followsUnitCount: c.unit_label === "per_unit" && String(c.quantity) === String(property.unit_count),
          condition: c.condition,
          notes: c.notes ?? "",
          // Missing until the database has update 0004.
          installYearIsGuess: c.install_year_is_estimate === true,
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
  | "notes_length"
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
  notes_length: `Notes can be up to ${MAX_NOTES_LENGTH.toLocaleString("en-US")} characters.`,
  year_built: `Year built must be a 4-digit year from ${EARLIEST_YEAR_BUILT} to this year, or blank.`,
  unit_count: "Rental units must be a whole number up to 100,000.",
};

/** The row field a row's save problem is about, so the editor can mark it. */
export function saveProblemFields(problem: SaveProblem): RowField[] {
  switch (problem) {
    case "name":
    case "name_length":
      return ["name"];
    case "quantity":
      return ["quantity"];
    case "life":
      return ["usefulLife"];
    case "install_year":
      return ["installYear"];
    case "cost":
      return ["costEach"];
    case "notes_length":
      return ["notes"];
    case "year_built":
    case "unit_count":
      return [];
  }
}

export interface SaveInput {
  property: SavePropertyInput;
  components: SaveComponentInput[];
  /** Why the draft can't be saved yet, by row id ("property" for the property fields). */
  problems: Record<string, SaveProblem>;
}

/** Characters as the database counts them, so an emoji is one, not two. */
function characterCount(text: string): number {
  return Array.from(text).length;
}

function validYear(year: number | null, currentYear: number, earliest = EARLIEST_INSTALL_YEAR): boolean {
  return year === null || (Number.isInteger(year) && year >= earliest && year <= currentYear);
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
  else if (!validYear(yearBuilt, currentYear, EARLIEST_YEAR_BUILT)) problems.property = "year_built";

  const components: SaveComponentInput[] = [];
  draft.rows.forEach((row, index) => {
    const quantity = parse(row.quantity);
    const life = parse(row.usefulLife);
    const installYear = parse(row.installYear);
    const cost = parse(row.costEach);
    const notes = (row.notes ?? "").trim();
    let problem: SaveProblem | null = null;
    if (!row.name.trim()) problem = "name";
    else if (row.name.trim().length > MAX_NAME_LENGTH) problem = "name_length";
    else if (quantity === null || !(quantity > 0 && quantity < MAX_QUANTITY)) problem = "quantity";
    else if (life === null || !Number.isInteger(life) || life < 1 || life > 100) problem = "life";
    else if (!validYear(installYear, currentYear)) problem = "install_year";
    else if (cost !== null && !(cost >= 0 && cost < MAX_COST)) problem = "cost";
    else if (characterCount(notes) > MAX_NOTES_LENGTH) problem = "notes_length";
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
      // Always sent, so clearing one clears it in the database too.
      condition: row.condition ?? null,
      notes: notes === "" ? null : notes,
      install_year_is_estimate: row.installYearIsGuess === true,
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
