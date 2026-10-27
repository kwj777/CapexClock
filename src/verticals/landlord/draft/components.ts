import { findAtRisk, validateComponent, type AtRiskComponent, type Component } from "@/engine";
import { parseNumber } from "../parse";
import { byUrgencyThenName, LANDLORD_RULES } from "../rules";
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

/** True when rental units is filled in but isn't a whole number of 1 or more. */
export function badUnitCount(value: string): boolean {
  const units = parseNumber(value);
  return units !== null && !(Number.isInteger(units) && units >= 1);
}

export const UNIT_COUNT_TEXT = "Rental units should be a whole number of 1 or more, like 12.";

export type RowProblem =
  | "missing_name"
  | "missing_install_year"
  | "bad_install_year"
  | "bad_year_built"
  | "missing_cost"
  | "invalid";

export interface ConvertedRows {
  components: Component[];
  problems: Record<string, RowProblem>;
}

/** Turns form rows into engine components; rows that aren't complete are reported, not guessed. */
export function toComponents(draft: Draft, currentYear: number): ConvertedRows {
  const yearBuilt = parseNumber(draft.yearBuilt);
  const yearBuiltIsBad = badYearBuilt(draft.yearBuilt, currentYear);
  const components: Component[] = [];
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
    const component: Component = {
      id: row.id,
      category: row.category,
      name: row.name.trim(),
      quantity: parseNumber(row.quantity) ?? NaN,
      installYear,
      usefulLifeYears: parseNumber(row.usefulLife) ?? NaN,
      replacementCostEach: cost,
      scenario: row.scenario,
      // Year built standing in for a blank year, or a year the owner says is a guess.
      estimated: { installYear: explicitYear === null || row.installYearIsGuess === true },
    };
    if (validateComponent(component).length > 0) {
      problems[row.id] = "invalid";
      continue;
    }
    components.push(component);
  }

  return { components, problems };
}

/**
 * Rows left out only because they have no cost yet that are past end of life or
 * due soon, most urgent first. The downloads still list them as at risk, outside
 * the totals.
 */
export function atRiskWithoutCost(draft: Pick<Draft, "yearBuilt" | "rows">, currentYear: number): AtRiskComponent[] {
  // Any cost will do to see whether the rest of the row is complete; it isn't used.
  const rows = draft.rows.filter((r) => parseNumber(r.costEach) === null).map((r) => ({ ...r, costEach: "0" }));
  const { components } = toComponents({ unitCount: "", yearBuilt: draft.yearBuilt, rows }, currentYear);
  return findAtRisk(components, currentYear, LANDLORD_RULES.atRiskYears).sort(byUrgencyThenName);
}

export const PROBLEM_TEXT: Record<RowProblem, string> = {
  missing_name: "Name this component.",
  missing_install_year: "Add an install year, or the building's year built.",
  bad_install_year: `Install year should be a 4-digit year from ${EARLIEST_INSTALL_YEAR} to this year.`,
  bad_year_built: "Fix the year built above, or add an install year.",
  missing_cost: "Add a replacement cost to include it.",
  invalid: "Check quantity (above 0), useful life (1–100 years) and cost (a plain number like 1400).",
};

/**
 * True for a problem that's only something not filled in yet (a new row's name,
 * install year or cost): a next step, not a mistake, so it isn't shown as an error.
 */
export function isMissingProblem(problem: RowProblem): boolean {
  return problem === "missing_name" || problem === "missing_install_year" || problem === "missing_cost";
}

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
    // A row following the unit count gets its quantity from Rental units at the top.
    quantity:
      row.unitLabel === "per_sq_ft"
        ? "Square feet should be a number above 0, like 1200."
        : row.unitLabel === "per_unit" && row.followsUnitCount
          ? "Enter the number of rental units at the top, or type how many here."
          : "Quantity should be a number above 0, like 12.",
    usefulLife: "Useful life should be a whole number of years from 1 to 100.",
    costEach: "Cost should be a plain number, like 1400.",
  };
  const fields = invalidFields(row);
  return fields.length > 0 ? fields.map((f) => text[f]).join(" ") : PROBLEM_TEXT.invalid;
}
