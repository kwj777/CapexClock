import { levelMonthlyReserve, MAX_YEARS_UNTIL_DUE, planExpenses, type FundingYear, type PlannedExpense } from "@/engine";
import { readNumber } from "./parse";

export interface ExpenseFields {
  id: number;
  cost: string;
  years: string;
}

export type ExpenseField = "cost" | "years";

export interface ExpenseRowProblem {
  message: string;
  /** The fields that need fixing, so only those are marked. */
  fields: ExpenseField[];
}

export interface ReserveInputs {
  expenses: PlannedExpense[];
  /** What's wrong with each row that can't be used, by row id. */
  rowProblems: Map<number, ExpenseRowProblem>;
  /** Blank counts as 0. */
  balance: number;
  balanceProblem: string | null;
  /** 0 when blank. */
  units: number;
  unitsProblem: string | null;
}

export const ROW_PROBLEM = `Enter a cost and a whole number of years from 0 to ${MAX_YEARS_UNTIL_DUE}.`;
export const COST_PROBLEM = "Enter the cost as a plain number, like 15000.";
export const YEARS_PROBLEM = `Enter whole years from 0 to ${MAX_YEARS_UNTIL_DUE}, like 5.`;
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
export function readReserveInputs(rows: readonly ExpenseFields[], balance: string, units: string): ReserveInputs {
  const expenses: PlannedExpense[] = [];
  const rowProblems = new Map<number, ExpenseRowProblem>();
  for (const r of rows) {
    const cost = readNumber(r.cost);
    const years = readNumber(r.years);
    if (cost === null && years === null) continue;
    if (years !== null && looksLikeYear(years)) {
      rowProblems.set(r.id, { message: YEAR_TYPED_PROBLEM, fields: ["years"] });
      continue;
    }
    const fields: ExpenseField[] = [];
    if (cost === null || Number.isNaN(cost) || cost < 0) fields.push("cost");
    if (years === null || !Number.isInteger(years) || years < 0 || years > MAX_YEARS_UNTIL_DUE) fields.push("years");
    if (cost === null || years === null || fields.length > 0) {
      // Say which box is wrong when only one is.
      const message = fields.length === 1 ? (fields[0] === "cost" ? COST_PROBLEM : YEARS_PROBLEM) : ROW_PROBLEM;
      rowProblems.set(r.id, { message, fields });
      continue;
    }
    expenses.push({ cost, yearsUntilDue: years });
  }

  const balanceValue = readNumber(balance);
  const balanceOk = balanceValue === null || (!Number.isNaN(balanceValue) && balanceValue >= 0);
  const unitsValue = readNumber(units);
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

export interface ReserveCalculatorResult {
  /** Smallest level monthly deposit that pays every expense on time. */
  readonly monthly: number;
  /** monthly ÷ units, or null when units is 0. */
  readonly perUnit: number | null;
  /** Cost due now that the current balance can't cover. */
  readonly shortfallNow: number;
  readonly total: number;
  /** One row per year from next year to the last year anything is due. */
  readonly schedule: readonly FundingYear[];
  /** What sets the monthly amount when an early expense does rather than the whole list, or null. */
  readonly setBy: ReserveSetBy | null;
}

export interface ReserveSetBy {
  /** What's due from next year up to and including `years` from now. */
  readonly cost: number;
  readonly years: number;
  /** True when some of `cost` is due before `years`, so it reads "over the next 2 years". */
  readonly spread: boolean;
  /** The smaller monthly amount that covers everything after that, once it's paid. */
  readonly after: number;
}

/**
 * When an early expense sets the monthly amount (the tightest year comes before
 * the last one), what's due by then and the smaller amount needed once it's
 * paid. Null when the amount is set by the whole list, or nothing after that
 * needs less.
 */
function setByEarlyExpense(schedule: readonly FundingYear[], monthly: number, carriedForward: number): ReserveSetBy | null {
  const spent = schedule.map((y) => y.spent);
  const { tightestIndex: years } = levelMonthlyReserve([0, ...spent], carriedForward);
  if (years === null || years >= spent.length) return null;
  const after = levelMonthlyReserve([0, ...spent.slice(years)], Math.max(0, schedule[years - 1].endBalance)).monthly;
  // Rounding to the dollar, as the page shows them: a cent less isn't "less".
  if (Math.ceil(after - 1e-6) >= Math.ceil(monthly - 1e-6)) return null;
  const early = spent.slice(0, years);
  return {
    cost: early.reduce((sum, s) => sum + s, 0),
    years,
    spread: early.slice(0, -1).some((s) => s > 0),
    after,
  };
}

/** The reserve calculator's figures: the engine's expense plan, plus per unit. */
export function reserveFromExpenses(
  expenses: readonly PlannedExpense[],
  currentBalance: number,
  units: number,
): ReserveCalculatorResult {
  const plan = planExpenses(expenses, currentBalance);
  return {
    monthly: plan.monthly,
    perUnit: units > 0 ? plan.monthly / units : null,
    shortfallNow: plan.shortfallNow,
    total: plan.total,
    schedule: plan.schedule,
    setBy: setByEarlyExpense(plan.schedule, plan.monthly, plan.carriedForward),
  };
}

/**
 * What the reserve calculator shows for its fields: what was read from them, and
 * the figures, or null until there's an expense and nothing needs fixing (a bad
 * unit count only leaves out the per-unit figure).
 */
export function reserveCalculator(
  rows: readonly ExpenseFields[],
  balance: string,
  units: string,
): { inputs: ReserveInputs; result: ReserveCalculatorResult | null } {
  const inputs = readReserveInputs(rows, balance, units);
  const ready = inputs.expenses.length > 0 && inputs.rowProblems.size === 0 && !inputs.balanceProblem;
  return { inputs, result: ready ? reserveFromExpenses(inputs.expenses, inputs.balance, inputs.units) : null };
}
