import type { Forecast, ForecastComponent } from "@/lib/forecast";
import { exportRows, LEFT_OUT_NOTE, type ExportDetails } from "./rows";

// Spreadsheet apps run cells starting with these as formulas; prefix them so a
// component named "=HYPERLINK(...)" stays plain text.
const FORMULA_START = /^[=+\-@\t\r]/;
// Apps set to split on ";" or tabs (common in Europe) start a new cell inside
// ours at those characters, so a formula can start there too.
const FORMULA_AFTER_SEPARATOR = /([,;\t|\r\n]\s*)([=+\-@])/g;

function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string") {
    text = text.replace(FORMULA_AFTER_SEPARATOR, "$1'$2");
    if (FORMULA_START.test(text)) text = `'${text}`;
  }
  return /[",;\t\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values: (string | number)[]): string {
  return values.map(cell).join(",");
}

/** Plain digits with at least 2 decimals: 16801.2 -> "16801.20", 0.125 -> "0.125". */
function amount(value: number, maxDecimals: number): string {
  // toFixed also drops float noise such as 956.9999999999999.
  return value.toFixed(maxDecimals).replace(/(\.\d\d\d*?)0+$/, "$1");
}

/**
 * One row per replacement in the forecast window, in year order, then one row
 * for each component left out because its details aren't complete.
 */
export function forecastCsv(
  forecast: Forecast,
  components: ForecastComponent[],
  details: ExportDetails = {},
): string {
  const lines = [
    row(["Year", "Component", "Category", "Quantity", "Unit", "Cost each", "Total cost", "Note"]),
  ];
  for (const r of exportRows(forecast, components, details.unitLabels)) {
    lines.push(
      row([
        r.year,
        r.name,
        r.category,
        r.quantity ?? "",
        r.quantity === null ? "" : r.unit,
        r.costEach === null ? "" : amount(r.costEach, 6),
        amount(r.total, 2),
        r.notes.join("; "),
      ]),
    );
  }
  for (const l of details.leftOut ?? []) {
    lines.push(row(["", l.name, l.category, "", "", "", "", LEFT_OUT_NOTE]));
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

export function exportFileName(name: string, extension: "csv" | "pdf", startYear: number): string {
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
  return `${slug || "capexclock"}-forecast-${startYear}.${extension}`;
}
