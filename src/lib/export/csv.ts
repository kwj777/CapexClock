import { CONDITION_TEXT } from "@/components/calculator/draft";
import type { Forecast, ForecastComponent } from "@/lib/forecast";
import type { ComponentCondition } from "@/lib/supabase/database.types";
import { guardFormulas } from "./formula-guard";
import { exportRows, LEFT_OUT_NOTE, type ExportDetails } from "./rows";

/** One cell of a CSV row, with formulas guarded and quotes where the value needs them. */
function cell(value: string | number): string {
  const text = typeof value === "string" ? guardFormulas(value) : String(value);
  return /[",;\t\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One line of a CSV file. */
export function csvRow(values: readonly (string | number)[]): string {
  return values.map(cell).join(",");
}

/** Plain digits with at least 2 decimals: 16801.2 -> "16801.20", 0.125 -> "0.125". */
function amount(value: number, maxDecimals: number): string {
  // toFixed also drops float noise such as 956.9999999999999.
  return value.toFixed(maxDecimals).replace(/(\.\d\d\d*?)0+$/, "$1");
}

function condition(value: ComponentCondition | null | undefined): string {
  return value ? CONDITION_TEXT[value] : "";
}

/**
 * One row per replacement in the forecast window, in year order, then one row
 * for each component left out because its details aren't complete. Each row
 * carries its component's condition and the owner's notes.
 */
export function forecastCsv(
  forecast: Forecast,
  components: ForecastComponent[],
  details: ExportDetails = {},
): string {
  const lines = [
    csvRow([
      "Year",
      "Component",
      "Category",
      "Quantity",
      "Unit",
      "Cost each",
      "Total cost",
      "Forecast note",
      "Condition",
      "Notes",
    ]),
  ];
  for (const r of exportRows(forecast, components, details.unitLabels, details.rowDetails)) {
    lines.push(
      csvRow([
        r.year,
        r.name,
        r.category,
        r.quantity ?? "",
        r.quantity === null ? "" : r.unit,
        r.costEach === null ? "" : amount(r.costEach, 6),
        amount(r.total, 2),
        r.notes.join("; "),
        condition(r.condition),
        r.ownerNotes,
      ]),
    );
  }
  for (const l of details.leftOut ?? []) {
    lines.push(csvRow(["", l.name, l.category, "", "", "", "", LEFT_OUT_NOTE, condition(l.condition), l.notes ?? ""]));
  }
  // CRLF is what spreadsheet apps expect from CSV.
  return lines.join("\r\n") + "\r\n";
}

// Latin letters that don't split into a base letter plus an accent.
const LATIN_LETTERS: Record<string, string> = {
  ł: "l",
  đ: "d",
  ð: "d",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  þ: "th",
  ı: "i",
};
const MAX_SLUG_LENGTH = 60;

/** A property name as a file name: "Résidence #2" becomes "residence-2", or "capexclock" when nothing's left. */
function fileSlug(name: string): string {
  const text = name
    .normalize("NFKD")
    .toLowerCase()
    // "Résidence" -> "residence". Accents in other scripts (Cyrillic й) stay.
    .replace(/([a-z])[\u0300-\u036f]+/g, "$1")
    .normalize("NFC")
    .replace(/[łđðøæœßþı]/g, (letter) => LATIN_LETTERS[letter])
    // Letters and digits in any script stay; spaces, quotes, slashes and the like become dashes.
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-");
  const slug = Array.from(text).slice(0, MAX_SLUG_LENGTH).join("").replace(/^-+|-+$/g, "");
  return slug || "capexclock";
}

export function exportFileName(name: string, extension: "csv" | "pdf", startYear: number): string {
  return `${fileSlug(name)}-forecast-${startYear}.${extension}`;
}

/** "maple-court-component-list.csv" */
export function componentListFileName(name: string): string {
  return `${fileSlug(name)}-component-list.csv`;
}
