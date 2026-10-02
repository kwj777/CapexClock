import { CONDITION_TEXT, exampleDraft, type DraftRow } from "@/components/calculator/draft";
import { COUNTED_PER_TEXT, FORMAT_COLUMNS, YES } from "@/lib/import/format";
import type { FieldKind } from "@/lib/import/columns";
import { csvRow } from "./csv";

/** The byte-order mark makes Excel read the file as UTF-8. */
export const BOM = "\uFEFF";

/** A number as typed ("1,400", "$38,000") written plainly ("1400"), or the text as it is when it isn't one. */
function plainNumber(text: string): string {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return trimmed;
  return String(Number(cleaned));
}

/** One row's cells, by the field each column holds. */
type RowValues = Partial<Record<FieldKind, string>>;

function line(values: RowValues): string {
  return csvRow(FORMAT_COLUMNS.map((c) => values[c.field] ?? ""));
}

/** The list's building details, written on every row so sorting or filtering the sheet keeps them. */
export interface ListBuilding {
  /** The property's name; blank in the public calculator, which has none. */
  name: string;
  unitCount: string;
  yearBuilt: string;
}

function rowValues(building: ListBuilding, row: DraftRow, withId: boolean): RowValues {
  return {
    building: building.name.trim(),
    unitCount: plainNumber(building.unitCount),
    yearBuilt: building.yearBuilt.trim(),
    item: row.name.trim(),
    category: row.category,
    quantity: plainNumber(row.quantity),
    countedPer: COUNTED_PER_TEXT[row.unitLabel],
    installYear: row.installYear.trim(),
    guess: row.installYearIsGuess ? YES : "",
    life: plainNumber(row.usefulLife),
    cost: plainNumber(row.costEach),
    condition: row.condition ? CONDITION_TEXT[row.condition] : "",
    replaceNow: row.scenario === "replace_now" ? YES : "",
    notes: (row.notes ?? "").trim(),
    id: withId ? row.id : "",
  };
}

/** The headings, then the rows. */
function file(rows: RowValues[]): string {
  const headings = Object.fromEntries(FORMAT_COLUMNS.map((c) => [c.field, c.heading]));
  // CRLF is what spreadsheet apps expect from CSV.
  return BOM + [headings, ...rows].map(line).join("\r\n") + "\r\n";
}

/**
 * Every component in the list, one per row, in CapexClock's own format. Each row
 * carries its CapexClock ID, so importing the file again updates these rows.
 */
export function componentListCsv(building: ListBuilding, rows: readonly DraftRow[]): string {
  return file(rows.map((r) => rowValues(building, r, true)));
}

/** The blank template: the headings and nothing else. */
export function templateCsv(): string {
  return file([]);
}

/** Condition, notes and a guess for some of the example's rows, to show what those columns hold. */
const EXAMPLE_DETAILS: Record<string, Partial<DraftRow>> = {
  "asphalt-shingle-roof": { condition: "fair", notes: "Patched over unit 4 in 2019" },
  "gas-furnace": { installYearIsGuess: true, condition: "fair" },
  "tank-water-heater": { condition: "good", notes: "40 gallon, gas" },
  refrigerator: { notes: "Original to the building, as far as we know" },
  carpet: { condition: "poor", scenario: "replace_now" },
};

/** The example building, as a filled-in template: the same one the calculator's Load an example shows. */
export function exampleRows(): DraftRow[] {
  return exampleDraft().rows.map((r) => ({ ...r, ...(r.librarySlug ? EXAMPLE_DETAILS[r.librarySlug] : undefined) }));
}

/** The example's building details, matching exampleDraft(). */
export const EXAMPLE_BUILDING: ListBuilding = { name: "Example: 12-unit building", unitCount: "12", yearBuilt: "1998" };

/** The filled-in example template, without CapexClock IDs since it isn't anyone's list. */
export function exampleCsv(): string {
  return file(exampleRows().map((r) => rowValues(EXAMPLE_BUILDING, r, false)));
}
