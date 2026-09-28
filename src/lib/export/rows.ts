import type { Forecast, ForecastComponent, UnitLabel } from "@/lib/forecast";

/** A form row the forecast leaves out because its details aren't complete. */
export interface LeftOut {
  name: string;
  category: string;
}

/** What the exports need beyond the forecast itself. */
export interface ExportDetails {
  /** How each component is counted, by component id. Square-foot items print "sq ft". */
  unitLabels?: ReadonlyMap<string, UnitLabel>;
  /** Rows left out of the forecast, so the export can say so. */
  leftOut?: LeftOut[];
}

/** One replacement as both the CSV and the PDF show it. */
export interface ExportRow {
  year: number;
  name: string;
  category: string;
  /** Null only if the component can't be found. */
  quantity: number | null;
  /** Unit of measure for the quantity and the cost each. */
  unit: "sq ft" | "each";
  costEach: number | null;
  /** Quantity × cost each, in whole cents. */
  total: number;
  notes: string[];
}

export const ESTIMATED_NOTE = "Install year estimated";
export const LEFT_OUT_NOTE = "Not included yet: details missing";

/** Rounds money to cents, which also clears float noise such as 956.9999999999999. */
export function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Every replacement in the window, in year order. */
export function exportRows(
  forecast: Forecast,
  components: ForecastComponent[],
  unitLabels: ReadonlyMap<string, UnitLabel> = new Map(),
): ExportRow[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  return forecast.years.flatMap((y) =>
    y.replacements.map((r): ExportRow => {
      const c = byId.get(r.componentId);
      return {
        year: r.year,
        name: r.name,
        category: r.category,
        quantity: c?.quantity ?? null,
        unit: unitLabels.get(r.componentId) === "per_sq_ft" ? "sq ft" : "each",
        costEach: c?.replacementCostEach ?? null,
        total: toCents(r.cost),
        notes: [r.overdue ? "Overdue" : "", c?.installYearIsEstimate ? ESTIMATED_NOTE : ""].filter(Boolean),
      };
    }),
  );
}

const MAX_NAMES = 5;

/** "2 components aren't included yet: Boiler and Carpet. …" for the top of the PDF. */
export function leftOutSummary(leftOut: LeftOut[]): string {
  const count = leftOut.length;
  if (count === 0) return "";
  const names = leftOut.slice(0, MAX_NAMES).map((l) => l.name);
  if (count > MAX_NAMES) names.push(`${count - MAX_NAMES} more`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return count === 1
    ? `1 component isn't included yet: ${list}. Its details aren't complete, so the figures here leave it out.`
    : `${count} components aren't included yet: ${list}. Their details aren't complete, so the figures here leave them out.`;
}
