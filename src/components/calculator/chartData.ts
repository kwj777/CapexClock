import { CHART_CATEGORIES, chartCategory, type ChartCategory, type LandlordForecast } from "@/verticals/landlord";

export type ChartRow = { year: number; total: number } & Partial<Record<ChartCategory, number>>;

/** Each year's costs by chart category, and the categories that appear at all (in fixed order). */
export function toChartRows(forecast: LandlordForecast): { rows: ChartRow[]; present: ChartCategory[] } {
  const present = new Set<ChartCategory>();
  const rows = forecast.years.map((y) => {
    const row: ChartRow = { year: y.year, total: y.total };
    for (const [category, cost] of Object.entries(y.byCategory)) {
      const key = chartCategory(category);
      row[key] = (row[key] ?? 0) + cost;
      present.add(key);
    }
    return row;
  });
  return { rows, present: CHART_CATEGORIES.filter((c) => present.has(c)) };
}

/** The tooltip's figure for a year: the amounts it lists (each category above 0), added in the order listed. */
export function tooltipTotal(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}
