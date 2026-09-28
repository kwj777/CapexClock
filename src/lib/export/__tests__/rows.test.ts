import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { formatCostEach, formatPrice, formatQuantity, moneyColumn } from "../format";
import { exportRows, leftOutSummary, toCents } from "../rows";

const components: ForecastComponent[] = [
  { id: "furnace", category: "HVAC", name: "Gas furnace", quantity: 12, installYear: 2012, installYearIsEstimate: true, usefulLifeYears: 18, replacementCostEach: 4200 },
  { id: "carpet", category: "Flooring", name: "Carpet", quantity: 9600, installYear: 2020, usefulLifeYears: 8, replacementCostEach: 4 },
  { id: "dw", category: "Appliances", name: "Dishwasher", quantity: 1, installYear: 2023, usefulLifeYears: 3, replacementCostEach: 650.5 },
  { id: "wh", category: "Plumbing", name: "Water heater", quantity: 1, installYear: 2010, installYearIsEstimate: true, usefulLifeYears: 10, replacementCostEach: 1400 },
];
const forecast = computeForecast({ startYear: 2026, unitCount: 12, components });
const rows = exportRows(forecast, components, new Map([["carpet", "per_sq_ft"]]));

describe("export rows", () => {
  it("flags estimated install years on every row, not just at-risk ones", () => {
    // 2012 + 18 = 2030: three years out, so not at risk, but still an estimate.
    expect(forecast.atRisk.map((a) => a.componentId)).not.toContain("furnace");
    expect(rows.find((r) => r.name === "Gas furnace")?.notes).toEqual(["Install year estimated"]);
    expect(rows.find((r) => r.name === "Water heater" && r.year === 2026)?.notes).toEqual([
      "Overdue",
      "Install year estimated",
    ]);
    expect(rows.find((r) => r.name === "Carpet")?.notes).toEqual([]);
  });

  it("carries the unit of measure", () => {
    expect(rows.find((r) => r.name === "Carpet")).toMatchObject({ quantity: 9600, unit: "sq ft", costEach: 4, total: 38400 });
    expect(rows.find((r) => r.name === "Gas furnace")).toMatchObject({ unit: "each" });
  });

  it("adds up to the forecast total", () => {
    const sum = rows.reduce((total, r) => total + r.total, 0);
    expect(toCents(sum)).toBe(toCents(forecast.total));
    expect(rows.filter((r) => r.name === "Dishwasher").map((r) => r.total)).toEqual([650.5, 650.5, 650.5, 650.5]);
  });
});

describe("money in exports", () => {
  it("rounds to cents", () => {
    expect(toCents(3300 * 0.29)).toBe(957);
    expect(toCents(12 * 1400.1)).toBe(16801.2);
    expect(toCents(3 * 0.1)).toBe(0.3);
  });

  it("shows cents on every row once any row has them, so the column adds up", () => {
    const money = moneyColumn(rows.map((r) => r.total));
    const dishwashers = rows.filter((r) => r.name === "Dishwasher").map((r) => money(r.total));
    expect(dishwashers).toEqual(["$650.50", "$650.50", "$650.50", "$650.50"]);
    expect(money(38400)).toBe("$38,400.00");
    expect(moneyColumn([1400, 38400])(38400)).toBe("$38,400");
    expect(moneyColumn([956.9999999999999])(956.9999999999999)).toBe("$957");
  });

  it("prints prices as entered, even below a cent", () => {
    expect(formatPrice(1400)).toBe("$1,400");
    expect(formatPrice(0.25)).toBe("$0.25");
    expect(formatPrice(0.125)).toBe("$0.125");
    expect(formatPrice(1400.1)).toBe("$1,400.10");
  });

  it("puts the unit next to area quantities and prices", () => {
    expect(formatQuantity({ quantity: 9600, unit: "sq ft" })).toBe("9,600 sq ft");
    expect(formatQuantity({ quantity: 12, unit: "each" })).toBe("12");
    expect(formatCostEach({ costEach: 0.125, unit: "sq ft" })).toBe("$0.125/sq ft");
    expect(formatCostEach({ costEach: 4200, unit: "each" })).toBe("$4,200");
    expect(formatCostEach({ costEach: null, unit: "each" })).toBe("");
  });
});

describe("left-out summary", () => {
  it("names what the figures leave out", () => {
    expect(leftOutSummary([])).toBe("");
    expect(leftOutSummary([{ name: "Boiler", category: "HVAC" }])).toBe(
      "1 component isn't included yet: Boiler. Its details aren't complete, so the figures here leave it out.",
    );
    expect(
      leftOutSummary([
        { name: "Boiler", category: "HVAC" },
        { name: "Carpet", category: "Flooring" },
      ]),
    ).toBe(
      "2 components aren't included yet: Boiler and Carpet. Their details aren't complete, so the figures here leave them out.",
    );
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((name) => ({ name, category: "Other" }));
    expect(leftOutSummary(many)).toMatch(/^7 components aren't included yet: A, B, C, D, E and 2 more\./);
  });
});
