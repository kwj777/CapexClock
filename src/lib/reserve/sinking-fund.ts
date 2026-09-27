export interface PlannedExpense {
  /** Cost in today's dollars. */
  cost: number;
  /** Whole years from now until it's due. 0 means due now. */
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

  const lastYear = Math.max(0, ...byYear.keys());
  let monthly = 0;
  let cumulative = 0;
  for (let n = 1; n <= lastYear; n++) {
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
