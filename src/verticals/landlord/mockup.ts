import { levelMonthlyReserve } from "@/engine";

/** The home page's made-up spending, $k per year by series, starting this year. */
export const MOCKUP_SERIES_KEYS = ["roof", "hvac", "water", "other"] as const;
export type MockupKey = (typeof MOCKUP_SERIES_KEYS)[number];
export const MOCKUP_SPEND: readonly Readonly<Record<MockupKey, number>>[] = [
  { roof: 0, hvac: 0, water: 4, other: 2 },
  { roof: 0, hvac: 12, water: 0, other: 3 },
  { roof: 0, hvac: 0, water: 5, other: 2 },
  { roof: 38, hvac: 0, water: 0, other: 4 },
  { roof: 0, hvac: 8, water: 3, other: 2 },
  { roof: 0, hvac: 0, water: 0, other: 6 },
  { roof: 0, hvac: 18, water: 5, other: 3 },
  { roof: 0, hvac: 0, water: 0, other: 2 },
  { roof: 0, hvac: 0, water: 6, other: 9 },
  { roof: 14, hvac: 6, water: 0, other: 3 },
];
export const MOCKUP_UNITS = 12;

/** The calculator's reserve for the mockup chart, per unit. */
export function mockupReservePerUnit(): number {
  const totals = MOCKUP_SPEND.map((values) => MOCKUP_SERIES_KEYS.reduce((sum, key) => sum + values[key], 0) * 1000);
  return levelMonthlyReserve(totals).monthly / MOCKUP_UNITS;
}

/** The badge figure: rounded up to whole dollars (no float allowance, as today). */
export function mockupBadgeReserve(): number {
  return Math.ceil(mockupReservePerUnit());
}
