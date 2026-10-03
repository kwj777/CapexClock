import type { ForecastComponent } from "@/lib/forecast";
import { validateComponent } from "@/lib/forecast";
import { parseNumber } from "../parse";
import type { Draft, DraftRow } from "./model";

/** Earliest install year a component can be given; older buildings use year built instead. */
export const EARLIEST_INSTALL_YEAR = 1900;
/** Earliest year built, matching the database. */
export const EARLIEST_YEAR_BUILT = 1800;

// Catches typos like "98" or "2106", which would otherwise read as long overdue or never due.
function isYearBetween(year: number, earliest: number, currentYear: number): boolean {
  return Number.isInteger(year) && year >= earliest && year <= currentYear;
}

/** True when year built is filled in but can't be a real year built. */
export function badYearBuilt(value: string, currentYear: number): boolean {
  const year = parseNumber(value);
  return year !== null && !isYearBetween(year, EARLIEST_YEAR_BUILT, currentYear);
}

export const YEAR_BUILT_TEXT = `Year built should be a 4-digit year from ${EARLIEST_YEAR_BUILT} to this year.`;

export type RowProblem =
  | "missing_name"
  | "missing_install_year"
  | "bad_install_year"
  | "bad_year_built"
  | "missing_cost"
  | "invalid";

export interface ConvertedRows {
  components: ForecastComponent[];
  problems: Record<string, RowProblem>;
}

/** Turns form rows into forecast components; rows that aren't complete are reported, not guessed. */
export function toComponents(draft: Draft, currentYear: number): ConvertedRows {
  const yearBuilt = parseNumber(draft.yearBuilt);
  const yearBuiltIsBad = badYearBuilt(draft.yearBuilt, currentYear);
  const components: ForecastComponent[] = [];
  const problems: Record<string, RowProblem> = {};

  for (const row of draft.rows) {
    if (!row.name.trim()) {
      problems[row.id] = "missing_name";
      continue;
    }
    const explicitYear = parseNumber(row.installYear);
    if (explicitYear !== null && !isYearBetween(explicitYear, EARLIEST_INSTALL_YEAR, currentYear)) {
      problems[row.id] = "bad_install_year";
      continue;
    }
    // A blank install year falls back to year built, which is checked on its own.
    if (explicitYear === null && yearBuiltIsBad) {
      problems[row.id] = "bad_year_built";
      continue;
    }
    const installYear = explicitYear ?? yearBuilt;
    if (installYear === null) {
      problems[row.id] = "missing_install_year";
      continue;
    }
    const cost = parseNumber(row.costEach);
    if (cost === null) {
      problems[row.id] = "missing_cost";
      continue;
    }
    const component: ForecastComponent = {
      id: row.id,
      category: row.category,
      name: row.name.trim(),
      quantity: parseNumber(row.quantity) ?? NaN,
      installYear,
      // Year built standing in for a blank year, or a year the owner says is a guess.
      installYearIsEstimate: explicitYear === null || row.installYearIsGuess === true,
      usefulLifeYears: parseNumber(row.usefulLife) ?? NaN,
      replacementCostEach: cost,
      scenario: row.scenario,
    };
    if (validateComponent(component).length > 0) {
      problems[row.id] = "invalid";
      continue;
    }
    components.push(component);
  }

  return { components, problems };
}

export const PROBLEM_TEXT: Record<RowProblem, string> = {
  missing_name: "Name this component.",
  missing_install_year: "Add an install year, or the building's year built.",
  bad_install_year: `Install year should be a 4-digit year from ${EARLIEST_INSTALL_YEAR} to this year.`,
  bad_year_built: "Fix the year built above, or add an install year.",
  missing_cost: "Add a replacement cost to include it.",
  invalid: "Check quantity (above 0), useful life (1–100 years) and cost (a plain number like 1400).",
};

/** A row's fields that a problem can point at. */
export type RowField = "name" | "quantity" | "installYear" | "usefulLife" | "costEach" | "notes";

type NumberField = "quantity" | "usefulLife" | "costEach";

/** The number fields that stop a named, dated, costed row from being used. */
function invalidFields(row: DraftRow): NumberField[] {
  const bad: NumberField[] = [];
  const quantity = parseNumber(row.quantity);
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) bad.push("quantity");
  const life = parseNumber(row.usefulLife);
  if (life === null || !Number.isInteger(life) || life < 1 || life > 100) bad.push("usefulLife");
  const cost = parseNumber(row.costEach);
  if (cost === null || !Number.isFinite(cost) || cost < 0) bad.push("costEach");
  return bad;
}

/** The fields to mark for a row's problem, so the message can point at them. */
export function problemFields(row: DraftRow, problem: RowProblem): RowField[] {
  switch (problem) {
    case "missing_name":
      return ["name"];
    case "missing_install_year":
    case "bad_install_year":
    case "bad_year_built":
      return ["installYear"];
    case "missing_cost":
      return ["costEach"];
    case "invalid":
      return invalidFields(row);
  }
}

/** What to tell the owner about a row's problem; for a bad number, says which one. */
export function problemText(row: DraftRow, problem: RowProblem): string {
  if (problem !== "invalid") return PROBLEM_TEXT[problem];
  const text: Record<NumberField, string> = {
    quantity:
      row.unitLabel === "per_sq_ft"
        ? "Square feet should be a number above 0, like 1200."
        : "Quantity should be a number above 0, like 12.",
    usefulLife: "Useful life should be a whole number of years from 1 to 100.",
    costEach: "Cost should be a plain number, like 1400.",
  };
  const fields = invalidFields(row);
  return fields.length > 0 ? fields.map((f) => text[f]).join(" ") : PROBLEM_TEXT.invalid;
}
