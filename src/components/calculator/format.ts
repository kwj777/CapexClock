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
