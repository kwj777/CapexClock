import type { ComponentCondition } from "@/lib/supabase/database.types";
import type { AtRiskComponent, Component, LandlordForecast, UnitLabel } from "@/verticals/landlord";

/** What the owner noted about a component, as the exports show it. */
export interface RowDetails {
  condition: ComponentCondition | null;
  /** Trimmed; empty when there are none. */
  notes: string;
  /** The owner typed an install year and marked it a guess. */
  installYearIsGuess: boolean;
}

/** A form row the forecast leaves out because its details aren't complete. */
export interface LeftOut {
  name: string;
  category: string;
  condition?: ComponentCondition | null;
  notes?: string;
}

/** A component with a condition or notes, for the PDF's list of them. */
export interface ConditionNote {
  name: string;
  condition: ComponentCondition | null;
  notes: string;
}

/** What the exports need beyond the forecast itself. */
export interface ExportDetails {
  /** How each component is counted, by component id. Square-foot items print "sq ft". */
  unitLabels?: ReadonlyMap<string, UnitLabel>;
  /** Each component's condition, notes and guess flag, by component id. */
  rowDetails?: ReadonlyMap<string, RowDetails>;
  /** Rows left out of the forecast, so the export can say so. */
  leftOut?: LeftOut[];
  /** Every row with a condition or notes, in the form's order. */
  conditionNotes?: ConditionNote[];
}

/** A calculator form row, as far as the exports need it. */
export interface ExportFormRow {
  id: string;
  name: string;
  category: string;
  unitLabel: UnitLabel;
  installYear?: string;
  condition?: ComponentCondition | null;
  notes?: string;
  installYearIsGuess?: boolean;
}

/**
 * True when the owner typed an install year and ticked "guess". With no year typed,
 * year built stands in, and that's what the exports say instead.
 */
export function guessedYear(row: Pick<ExportFormRow, "installYear" | "installYearIsGuess">): boolean {
  return row.installYearIsGuess === true && (row.installYear ?? "").trim() !== "";
}

function rowDetails(row: ExportFormRow): RowDetails {
  return { condition: row.condition ?? null, notes: (row.notes ?? "").trim(), installYearIsGuess: guessedYear(row) };
}

function rowName(row: Pick<ExportFormRow, "name">): string {
  return row.name.trim() || "Unnamed component";
}

/**
 * The units and details of every form row, and the rows the forecast left out
 * because their details aren't complete (the forecast only has the complete ones).
 */
export function exportDetails(
  formRows: readonly ExportFormRow[],
  components: readonly Pick<Component, "id">[],
): ExportDetails {
  const included = new Set(components.map((c) => c.id));
  return {
    unitLabels: new Map(formRows.map((r) => [r.id, r.unitLabel])),
    rowDetails: new Map(formRows.map((r) => [r.id, rowDetails(r)])),
    leftOut: formRows
      .filter((r) => !included.has(r.id))
      .map((r) => {
        const { condition, notes } = rowDetails(r);
        return { name: rowName(r), category: r.category, condition, notes };
      }),
    conditionNotes: formRows
      .map((r) => ({ name: rowName(r), ...rowDetails(r) }))
      .filter((r) => r.condition !== null || r.notes !== "")
      .map(({ name, condition, notes }) => ({ name, condition, notes })),
  };
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
  /** Quantity × cost each, in dollars rounded to the cent. */
  total: number;
  /** What the forecast says about this replacement, e.g. "Overdue". */
  notes: string[];
  condition: ComponentCondition | null;
  /** The owner's own notes on the component; empty when there are none. */
  ownerNotes: string;
}

export const ESTIMATED_NOTE = "Install year estimated";
export const GUESS_NOTE = "Install year is a guess";
export const LEFT_OUT_NOTE = "Not included yet: details missing";

/**
 * Why a forecast's install year is an estimate: year built standing in for a blank
 * year, or a year the owner marked as a guess. Empty when it isn't one.
 */
export function installYearNote(isEstimate: boolean, details: Pick<RowDetails, "installYearIsGuess"> | undefined): string {
  if (!isEstimate) return "";
  return details?.installYearIsGuess ? GUESS_NOTE : ESTIMATED_NOTE;
}

/** Rounds money to cents, which also clears float noise such as 956.9999999999999. */
export function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Adds up rounded row totals, so a total matches the rows it covers to the cent. */
export function sumTotals(rows: readonly Pick<ExportRow, "total">[]): number {
  return toCents(rows.reduce((sum, r) => sum + r.total, 0));
}

/** Every replacement in the window, in year order. */
export function exportRows(
  forecast: Pick<LandlordForecast, "years">,
  components: readonly Component[],
  unitLabels: ReadonlyMap<string, UnitLabel> = new Map(),
  details: ReadonlyMap<string, RowDetails> = new Map(),
): ExportRow[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  return forecast.years.flatMap((y) =>
    y.replacements.map((r): ExportRow => {
      const c = byId.get(r.componentId);
      const d = details.get(r.componentId);
      return {
        year: r.year,
        name: r.name,
        category: r.category,
        quantity: c?.quantity ?? null,
        unit: unitLabels.get(r.componentId) === "per_sq_ft" ? "sq ft" : "each",
        costEach: c?.replacementCostEach ?? null,
        total: toCents(r.cost),
        notes: [r.overdue ? "Overdue" : "", installYearNote(r.estimated.installYear, d)].filter(Boolean),
        condition: d?.condition ?? null,
        ownerNotes: d?.notes ?? "",
      };
    }),
  );
}

/** The PDF's year figures, from the rounded rows it prints, so they match its table to the cent. */
export interface PdfYearFigures {
  /** Each year in the window, adding up that year's rows. */
  years: { year: number; total: number }[];
  /** The biggest year's total, at least 1: a full-width bar. */
  maxYear: number;
  /** The first year's total, shown as "Needed in". */
  neededNow: number;
  /** Every row added up, shown as the 10-year total. */
  horizonTotal: number;
}

export function pdfYearFigures(forecast: Pick<LandlordForecast, "years">, rows: readonly ExportRow[]): PdfYearFigures {
  const years = forecast.years.map((y) => ({ year: y.year, total: sumTotals(rows.filter((r) => r.year === y.year)) }));
  return {
    years,
    maxYear: Math.max(1, ...years.map((y) => y.total)),
    neededNow: years[0].total,
    horizonTotal: sumTotals(rows),
  };
}

/** How wide a year's bar is, as a percent of the biggest year's. */
export function barPercent(total: number, maxYear: number): number {
  return (total / maxYear) * 100;
}

/** "3 yrs past end of life", "due this year" or "due in 1 yr", for the PDF's at-risk list. */
export function atRiskShortText(item: Pick<AtRiskComponent, "status" | "yearsRemaining">): string {
  if (item.status === "overdue") {
    return `${-item.yearsRemaining} yr${item.yearsRemaining === -1 ? "" : "s"} past end of life`;
  }
  return item.yearsRemaining === 0
    ? "due this year"
    : `due in ${item.yearsRemaining} yr${item.yearsRemaining === 1 ? "" : "s"}`;
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
