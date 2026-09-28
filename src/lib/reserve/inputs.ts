import { MAX_YEARS_UNTIL_DUE, type PlannedExpense } from "./sinking-fund";

export interface ExpenseFields {
  id: number;
  cost: string;
  years: string;
}

export interface ReserveInputs {
  expenses: PlannedExpense[];
  /** What's wrong with each row that can't be used, by row id. */
  rowProblems: Map<number, string>;
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
export const UNITS_PROBLEM = "Enter units as a whole number, like 12.";

/**
 * Reads the reserve calculator's fields. Anything typed that can't be used is
 * reported rather than treated as blank, so a balance of "$30k" isn't
 * silently counted as no balance.
 */
export function readReserveInputs(rows: ExpenseFields[], balance: string, units: string): ReserveInputs {
  const expenses: PlannedExpense[] = [];
  const rowProblems = new Map<number, string>();
  for (const r of rows) {
    const cost = num(r.cost);
    const years = num(r.years);
    if (cost === null && years === null) continue;
    if (years !== null && Number.isInteger(years) && years >= 1900) {
      rowProblems.set(r.id, YEAR_TYPED_PROBLEM);
      continue;
    }
    if (
      cost === null ||
      Number.isNaN(cost) ||
      cost < 0 ||
      years === null ||
      !Number.isInteger(years) ||
      years < 0 ||
      years > MAX_YEARS_UNTIL_DUE
    ) {
      rowProblems.set(r.id, ROW_PROBLEM);
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
