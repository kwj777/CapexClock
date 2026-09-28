import { toCents, type ExportRow } from "./rows";

const wholeDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Area prices can go below a cent ($0.125 per sq ft), so keep what was entered.
const exactPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** A price as entered: "$1,400", "$0.25", "$0.125". */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? wholeDollars.format(value) : exactPrice.format(value);
}

/** Cost each with its unit, e.g. "$4/sq ft". */
export function formatCostEach(row: Pick<ExportRow, "costEach" | "unit">): string {
  if (row.costEach === null) return "";
  return row.unit === "sq ft" ? `${formatPrice(row.costEach)}/sq ft` : formatPrice(row.costEach);
}

/** Quantity with its unit, e.g. "9,600 sq ft" or "12". */
export function formatQuantity(row: Pick<ExportRow, "quantity" | "unit">): string {
  if (row.quantity === null) return "";
  const text = row.quantity.toLocaleString("en-US");
  return row.unit === "sq ft" ? `${text} sq ft` : text;
}

/**
 * Formatter for a column of amounts: whole dollars, unless some amount has
 * cents, in which case every amount shows cents so the column adds up.
 */
export function moneyColumn(values: number[]): (value: number) => string {
  const cents = values.some((v) => !Number.isInteger(toCents(v)));
  const format = cents ? withCents : wholeDollars;
  return (value) => format.format(toCents(value));
}
