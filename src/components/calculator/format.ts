const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number): string {
  return money.format(value);
}

/**
 * Monthly reserve amounts round up to the next dollar, so saving the amount
 * shown never leaves the fund short. The tiny allowance keeps float noise
 * (200.0000000001) from adding a dollar.
 */
export function formatReserve(value: number): string {
  return money.format(Math.ceil(value - 1e-6) || 0);
}

export function formatCompactMoney(value: number): string {
  return compactMoney.format(value);
}

const moneyWithCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Unit prices keep their cents ($0.25 per sq ft), whole-dollar ones don't. */
export function formatUnitPrice(value: number): string {
  return Number.isInteger(value) ? money.format(value) : moneyWithCents.format(value);
}

/**
 * A typical cost range, like "$800–$2,300" or "$0.15–$0.30". Both ends keep cents
 * when either has them, so "$2.50–$4.00" doesn't read as two kinds of number.
 */
export function formatCostRange(low: number, high: number): string {
  const format = Number.isInteger(low) && Number.isInteger(high) ? money : moneyWithCents;
  return low === high ? format.format(low) : `${format.format(low)}–${format.format(high)}`;
}

/**
 * The sentence after the monthly reserve's explanation when the owner picked a
 * safety buffer, or "" when there's none.
 */
export function safetyBufferSentence(forecast: {
  readonly contingencyRate: number;
  readonly monthlyReserveBeforeContingency: number;
}): string {
  if (!(forecast.contingencyRate > 0)) return "";
  const percent = Math.round(forecast.contingencyRate * 100);
  return `It includes a ${percent}% safety buffer (${formatReserve(forecast.monthlyReserveBeforeContingency)} a month without it).`;
}
