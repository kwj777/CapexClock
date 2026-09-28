import type { Forecast } from "@/lib/forecast";
import { formatMoney, formatReserve } from "./format";

/**
 * A short summary of the results for screen readers, spoken when it changes:
 * the monthly reserve, what's needed now and how many rows are left out.
 * Empty when there's nothing to say yet.
 */
export function forecastSummary(forecast: Forecast | null, incomplete: number): string {
  const parts: string[] = [];
  if (forecast) {
    const perUnit =
      forecast.monthlyReservePerUnit === null ? "" : `, ${formatReserve(forecast.monthlyReservePerUnit)} per unit`;
    parts.push(`Monthly reserve ${formatReserve(forecast.monthlyReserve)}${perUnit}.`);
    parts.push(`Needed in ${forecast.startYear}: ${formatMoney(forecast.neededNow)}.`);
  }
  if (incomplete > 0) {
    parts.push(`${incomplete} component${incomplete === 1 ? " isn't" : "s aren't"} included yet.`);
  }
  return parts.join(" ");
}
