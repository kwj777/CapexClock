import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { exportFileName, forecastCsv } from "../csv";

const components: ForecastComponent[] = [
  { id: "wh", category: "Plumbing", name: "Water heaters", quantity: 12, installYear: 2010, usefulLifeYears: 10, replacementCostEach: 1400 },
  { id: "roof", category: "Roofing", name: 'Roof, "main"', quantity: 1, installYear: 2008, installYearIsEstimate: true, usefulLifeYears: 22, replacementCostEach: 38000 },
  { id: "evil", category: "Other", name: "=HYPERLINK(\"x\")", quantity: 1, installYear: 2020, usefulLifeYears: 8, replacementCostEach: 10 },
];
const forecast = computeForecast({ startYear: 2026, unitCount: 12, components });

describe("forecast CSV", () => {
  const lines = forecastCsv(forecast, components).trimEnd().split("\r\n");

  it("has a header and one row per replacement, in year order", () => {
    expect(lines[0]).toBe("Year,Component,Category,Quantity,Cost each,Total cost,Note");
    expect(lines.slice(1).map((l) => l.split(",")[0])).toEqual(["2026", "2028", "2030"]);
  });

  it("marks overdue and estimated rows", () => {
    expect(lines[1]).toBe("2026,Water heaters,Plumbing,12,1400,16800,Overdue");
    expect(lines.find((l) => l.startsWith("2030"))).toBe('2030,"Roof, ""main""",Roofing,1,38000,38000,Install year estimated');
  });

  it("stops spreadsheet formulas in names", () => {
    expect(lines.find((l) => l.startsWith("2028"))).toBe(`2028,"'=HYPERLINK(""x"")",Other,1,10,10,`);
  });

  it("names files after the property", () => {
    expect(exportFileName("14 Maple Ct.", "pdf", 2026)).toBe("14-maple-ct-forecast-2026.pdf");
    expect(exportFileName("", "csv", 2026)).toBe("capexclock-forecast-2026.csv");
  });
});
