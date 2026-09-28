import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { exportFileName, forecastCsv } from "../csv";

const components: ForecastComponent[] = [
  { id: "wh", category: "Plumbing", name: "Water heaters", quantity: 12, installYear: 2010, usefulLifeYears: 10, replacementCostEach: 1400 },
  { id: "roof", category: "Roofing", name: 'Roof, "main"', quantity: 1, installYear: 2008, installYearIsEstimate: true, usefulLifeYears: 22, replacementCostEach: 38000 },
  { id: "evil", category: "Other", name: "=HYPERLINK(\"x\")", quantity: 1, installYear: 2020, usefulLifeYears: 8, replacementCostEach: 10 },
];
const forecast = computeForecast({ startYear: 2026, unitCount: 12, components });

function csvLines(list: ForecastComponent[], details?: Parameters<typeof forecastCsv>[2]): string[] {
  return forecastCsv(computeForecast({ startYear: 2026, unitCount: 1, components: list }), list, details)
    .trimEnd()
    .split("\r\n");
}

describe("forecast CSV", () => {
  const lines = forecastCsv(forecast, components).trimEnd().split("\r\n");

  it("has a header and one row per replacement, in year order", () => {
    expect(lines[0]).toBe("Year,Component,Category,Quantity,Unit,Cost each,Total cost,Note");
    expect(lines.slice(1).map((l) => l.split(",")[0])).toEqual(["2026", "2028", "2030"]);
  });

  it("marks overdue and estimated rows", () => {
    expect(lines[1]).toBe("2026,Water heaters,Plumbing,12,each,1400.00,16800.00,Overdue");
    expect(lines.find((l) => l.startsWith("2030"))).toBe(
      '2030,"Roof, ""main""",Roofing,1,each,38000.00,38000.00,Install year estimated',
    );
  });

  it("stops spreadsheet formulas in names", () => {
    expect(lines.find((l) => l.startsWith("2028"))).toBe(`2028,"'=HYPERLINK(""x"")",Other,1,each,10.00,10.00,`);
  });

  it("stops formulas that start after a separator inside a name", () => {
    const names = [
      "x;=1+1;",
      "Roof\t+SUM(1)",
      "Deck|@A1",
      "Gutters, -2+3",
      "Boiler; =1+1",
      "Porch\n=1+1",
      'x;"=1+1;',
      'x;"=HYPERLINK(1);',
      'Fence; " =1+1',
      ' =1+1',
      '"@SUM(1)"',
    ];
    const out = csvLines(
      names.map((name, i) => ({ id: `n${i}`, category: "Other", name, quantity: 1, installYear: 2020, usefulLifeYears: 5, replacementCostEach: 1000 })),
    );
    expect(out[1]).toBe(`2026,"x;'=1+1;",Other,1,each,1000.00,1000.00,Overdue`);
    expect(out[7]).toBe(`2026,"x;""'=1+1;",Other,1,each,1000.00,1000.00,Overdue`);
    // Split the file the way an app set to each of these separators would, ignoring quotes.
    for (const separator of [",", ";", "\t", "|", "\n"]) {
      const cells = out.join("\n").split(separator).map((c) => c.replace(/^[\s"]+/, ""));
      expect(cells.filter((c) => /^[=+\-@]/.test(c))).toEqual([]);
    }
  });

  it("writes money to the cent, without float noise", () => {
    const out = csvLines([
      { id: "a", category: "Site", name: "Seal coat", quantity: 3300, installYear: 2020, usefulLifeYears: 5, replacementCostEach: 0.29 },
      { id: "b", category: "Appliances", name: "Range", quantity: 12, installYear: 2016, usefulLifeYears: 14, replacementCostEach: 1400.1 },
      { id: "c", category: "Flooring", name: "LVP", quantity: 3, installYear: 2010, usefulLifeYears: 10, replacementCostEach: 4.1 },
      { id: "d", category: "Site", name: "Striping", quantity: 8000, installYear: 2020, usefulLifeYears: 5, replacementCostEach: 0.125 },
    ]);
    expect(out).toContain("2026,Seal coat,Site,3300,each,0.29,957.00,Overdue");
    expect(out).toContain("2030,Range,Appliances,12,each,1400.10,16801.20,");
    expect(out).toContain("2026,LVP,Flooring,3,each,4.10,12.30,Overdue");
    expect(out).toContain("2026,Striping,Site,8000,each,0.125,1000.00,Overdue");
    expect(out.join("\n")).not.toMatch(/\d\.\d{7,}/);
  });

  it("gives each row its unit of measure", () => {
    const out = csvLines(
      [
        { id: "carpet", category: "Flooring", name: "Carpet", quantity: 9600, installYear: 2020, usefulLifeYears: 8, replacementCostEach: 4 },
        { id: "wh", category: "Plumbing", name: "Water heaters", quantity: 12, installYear: 2018, usefulLifeYears: 10, replacementCostEach: 1400 },
      ],
      { unitLabels: new Map([["carpet", "per_sq_ft"], ["wh", "per_unit"]]) },
    );
    expect(out).toContain("2028,Carpet,Flooring,9600,sq ft,4.00,38400.00,");
    expect(out).toContain("2028,Water heaters,Plumbing,12,each,1400.00,16800.00,");
  });

  it("lists components left out of the forecast", () => {
    const out = csvLines(components.slice(0, 1), { leftOut: [{ name: "Boiler", category: "HVAC" }] });
    expect(out.at(-1)).toBe(",Boiler,HVAC,,,,,Not included yet: details missing");
  });
});

describe("export file names", () => {
  it("names files after the property", () => {
    expect(exportFileName("14 Maple Ct.", "pdf", 2026)).toBe("14-maple-ct-forecast-2026.pdf");
    expect(exportFileName("", "csv", 2026)).toBe("capexclock-forecast-2026.csv");
    expect(exportFileName("🔥 #1", "csv", 2026)).toBe("1-forecast-2026.csv");
  });

  it("keeps accented and non-Latin names readable", () => {
    expect(exportFileName("Résidence Élysée", "pdf", 2026)).toBe("residence-elysee-forecast-2026.pdf");
    expect(exportFileName("Łódź Apartments", "pdf", 2026)).toBe("lodz-apartments-forecast-2026.pdf");
    expect(exportFileName("Nguyễn Duplex", "pdf", 2026)).toBe("nguyen-duplex-forecast-2026.pdf");
    expect(exportFileName("Café 12", "csv", 2026)).toBe("cafe-12-forecast-2026.csv");
    expect(exportFileName("Straße Ørsted", "csv", 2026)).toBe("strasse-orsted-forecast-2026.csv");
    expect(exportFileName('Łódź Résidence – 東京 #2 "Main"', "pdf", 2026)).toBe(
      "lodz-residence-東京-2-main-forecast-2026.pdf",
    );
    expect(exportFileName("Дом на Мойке", "pdf", 2026)).toBe("дом-на-мойке-forecast-2026.pdf");
  });

  it("keeps long names to a sensible length", () => {
    const name = exportFileName("Maple ".repeat(40), "pdf", 2026);
    expect(name).toBe(`${"maple-".repeat(10).slice(0, -1)}-forecast-2026.pdf`);
  });
});
