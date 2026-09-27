import type { Forecast, ForecastComponent } from "@/lib/forecast";

// Spreadsheet apps run cells starting with these as formulas; prefix them so a
// component named "=HYPERLINK(...)" stays plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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

export function exportFileName(name: string, extension: "csv" | "pdf", startYear: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "capexclock"}-forecast-${startYear}.${extension}`;
}
