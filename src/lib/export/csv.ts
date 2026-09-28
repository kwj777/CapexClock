import type { Forecast, ForecastComponent } from "@/lib/forecast";

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

/** One row per replacement in the forecast window, in year order. */
export function forecastCsv(forecast: Forecast, components: ForecastComponent[]): string {
  const byId = new Map(components.map((c) => [c.id, c]));
  const lines = [
    row(["Year", "Component", "Category", "Quantity", "Cost each", "Total cost", "Note"]),
  ];
  for (const year of forecast.years) {
    for (const r of year.replacements) {
      const c = byId.get(r.componentId);
      const notes = [
        r.overdue ? "Overdue" : "",
        c?.installYearIsEstimate ? "Install year estimated" : "",
      ].filter(Boolean);
      lines.push(
        row([
          r.year,
          r.name,
          r.category,
          c?.quantity ?? "",
          c?.replacementCostEach ?? "",
          r.cost,
          notes.join("; "),
        ]),
      );
    }
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
