// FROZEN COPY of src/lib/reserve/sinking-fund.ts at commit 94acb55 (main), kept so the engine refactor can be
// checked against today's math bit for bit. Do not edit: the "Today's numbers
// unchanged" check fails on any change here. Imports were made relative; nothing else changed.

/** Longest a planned expense can be from now; anything later is almost always a typo. */
export const MAX_YEARS_UNTIL_DUE = 100;

export interface PlannedExpense {
  /** Cost in today's dollars. */
  cost: number;
  /** Whole years from now until it's due, up to MAX_YEARS_UNTIL_DUE. 0 means due now. */
  yearsUntilDue: number;
}

export interface SinkingFundInput {
  expenses: PlannedExpense[];
  currentBalance: number;
  units: number;
}

export interface SinkingFundYear {
  year: number;
  deposits: number;
  spent: number;
  endBalance: number;
}

export interface SinkingFundResult {
  /** Smallest level monthly deposit that pays every expense on time. */
  monthly: number;
  /** monthly ÷ units, or null when units is 0. */
  perUnit: number | null;
  /** Cost due now that the current balance can't cover. */
  shortfallNow: number;
  total: number;
  schedule: SinkingFundYear[];
}

/**
 * Level monthly deposit so the fund never runs short: for every due year n,
 * the balance left after anything due now plus 12·n deposits must cover
 * everything due by year n.
 */
export function sinkingFund({ expenses, currentBalance, units }: SinkingFundInput): SinkingFundResult {
  if (expenses.some((e) => e.yearsUntilDue > MAX_YEARS_UNTIL_DUE)) {
    throw new RangeError(`Years until due can't be more than ${MAX_YEARS_UNTIL_DUE}.`);
  }
  const valid = expenses.filter((e) => e.cost > 0 && Number.isFinite(e.cost) && e.yearsUntilDue >= 0);
  const byYear = new Map<number, number>();
  for (const e of valid) {
    const y = Math.floor(e.yearsUntilDue);
    byYear.set(y, (byYear.get(y) ?? 0) + e.cost);
  }
  const dueNow = byYear.get(0) ?? 0;
  const balance = Math.max(0, currentBalance);
  const shortfallNow = Math.max(0, dueNow - balance);
  const available = Math.max(0, balance - dueNow);

  const dueYears = [...byYear.keys()].filter((n) => n > 0).sort((a, b) => a - b);
  const lastYear = dueYears.at(-1) ?? 0;
  // The tightest point is always a year something comes due.
  let monthly = 0;
  let cumulative = 0;
  for (const n of dueYears) {
    cumulative += byYear.get(n) ?? 0;
    monthly = Math.max(monthly, (cumulative - available) / (12 * n));
  }

  const schedule: SinkingFundYear[] = [];
  let running = available;
  for (let n = 1; n <= lastYear; n++) {
    const deposits = monthly * 12;
    const spent = byYear.get(n) ?? 0;
    running += deposits - spent;
    schedule.push({ year: n, deposits, spent, endBalance: running });
  }

  return {
    monthly,
    perUnit: units > 0 ? monthly / units : null,
    shortfallNow,
    total: valid.reduce((s, e) => s + e.cost, 0),
    schedule,
  };
}
