// FROZEN COPY of src/lib/reserve/inputs.ts at commit 94acb55 (main), kept so the engine refactor can be
// checked against today's math bit for bit. Do not edit: the "Today's numbers
// unchanged" check fails on any change here. Imports were made relative; nothing else changed.

import { MAX_YEARS_UNTIL_DUE, type PlannedExpense } from "./sinking-fund";

export interface ExpenseFields {
  id: number;
  cost: string;
  years: string;
}

export type ExpenseField = "cost" | "years";

export interface RowProblem {
  message: string;
  /** The fields that need fixing, so only those are marked. */
  fields: ExpenseField[];
}

export interface ReserveInputs {
  expenses: PlannedExpense[];
  /** What's wrong with each row that can't be used, by row id. */
  rowProblems: Map<number, RowProblem>;
  /** Blank counts as 0. */
  balance: number;
  balanceProblem: string | null;
  /** 0 when blank. */
  units: number;
  unitsProblem: string | null;
}

/** Null when blank; NaN when something was typed that isn't a number (e.g. "$30k"). */
function num(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export const ROW_PROBLEM = `Enter a cost and a whole number of years from 0 to ${MAX_YEARS_UNTIL_DUE}.`;
export const YEAR_TYPED_PROBLEM = "Enter how many years from now it's due, like 5, not the year.";
export const BALANCE_PROBLEM = "Enter your balance as a plain number, like 30000.";
export const UNITS_PROBLEM = "Enter units as a whole number above 0, like 12.";

/** Due years someone might type by mistake (2031 for "in 5 years"); bigger numbers are just too many years. */
function looksLikeYear(years: number): boolean {
  return Number.isInteger(years) && years >= 1900 && years <= 2199;
}

/**
 * Reads the reserve calculator's fields. Anything typed that can't be used is
 * reported rather than treated as blank, so a balance of "$30k" isn't
 * silently counted as no balance.
 */
export function readReserveInputs(rows: ExpenseFields[], balance: string, units: string): ReserveInputs {
  const expenses: PlannedExpense[] = [];
  const rowProblems = new Map<number, RowProblem>();
  for (const r of rows) {
    const cost = num(r.cost);
    const years = num(r.years);
    if (cost === null && years === null) continue;
    if (years !== null && looksLikeYear(years)) {
      rowProblems.set(r.id, { message: YEAR_TYPED_PROBLEM, fields: ["years"] });
      continue;
    }
    const fields: ExpenseField[] = [];
    if (cost === null || Number.isNaN(cost) || cost < 0) fields.push("cost");
    if (years === null || !Number.isInteger(years) || years < 0 || years > MAX_YEARS_UNTIL_DUE) fields.push("years");
    if (cost === null || years === null || fields.length > 0) {
      rowProblems.set(r.id, { message: ROW_PROBLEM, fields });
      continue;
    }
    expenses.push({ cost, yearsUntilDue: years });
  }

  const balanceValue = num(balance);
  const balanceOk = balanceValue === null || (!Number.isNaN(balanceValue) && balanceValue >= 0);
  const unitsValue = num(units);
  const unitsOk = unitsValue === null || (Number.isInteger(unitsValue) && unitsValue > 0);

  return {
    expenses,
    rowProblems,
    balance: balanceOk ? (balanceValue ?? 0) : 0,
    balanceProblem: balanceOk ? null : BALANCE_PROBLEM,
    units: unitsOk ? (unitsValue ?? 0) : 0,
    unitsProblem: unitsOk ? null : UNITS_PROBLEM,
  };
}

/**
 * The fields to mark as wrong right now. A field is only checked once the owner
 * has left it, so typing a cost doesn't flag the years they haven't reached yet.
 */
export function shownFields(problem: RowProblem | undefined, touched: ReadonlySet<ExpenseField>): ExpenseField[] {
  return problem ? problem.fields.filter((f) => touched.has(f)) : [];
}
