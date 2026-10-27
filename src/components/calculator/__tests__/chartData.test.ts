import { landlordForecast, type Component } from "@/verticals/landlord";
import { dueByYear, toChartRows } from "../chartData";

const c = (id: string, category: string, installYear: number, cost: number): Component => ({
  id,
  category,
  name: id,
  quantity: 1,
  installYear,
  usefulLifeYears: 10,
  replacementCostEach: cost,
});

describe("the chart's numbers (also read out as a table)", () => {
  it("totals each year by chart category, folding unknown categories into Other", () => {
    const f = landlordForecast(
      [c("roof", "Roofing", 2018, 30000), c("elevator", "Elevators", 2018, 5000), c("gate", "Site", 2027, 800)],
      1,
      2026,
    );
    const { rows, present } = toChartRows(f);
    expect(rows).toHaveLength(10);
    expect(rows[2]).toMatchObject({ year: 2028, total: 35000, Roofing: 30000, Other: 5000 });
    expect(rows[0]).toEqual({ year: 2026, total: 0 });
    expect(present).toEqual(["Roofing", "Other"]);
  });
});

describe("what's due when, by year", () => {
  it("groups the rows by year, in order, and totals each year", () => {
    const f = landlordForecast(
      [c("roof", "Roofing", 2018, 30000), c("boiler", "HVAC", 2018, 5000.5), c("gate", "Site", 2020, 800)],
      1,
      2026,
    );
    const years = dueByYear(f.replacements);
    expect(years.map((y) => [y.year, y.total, y.items.map((r) => r.name)])).toEqual([
      [2028, 35000.5, ["roof", "boiler"]],
      [2030, 800, ["gate"]],
    ]);
  });

  it("is empty when nothing is due", () => {
    expect(dueByYear([])).toEqual([]);
  });
});
