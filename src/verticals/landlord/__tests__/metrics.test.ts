import type { AssetGroup, Component, ForecastResult } from "@/engine";
import { landlordForecast } from "../forecast";
import { assertUnitCount, landlordMetrics, portfolioMetrics, type LandlordFacts } from "../metrics";
import type { VerticalGroup } from "../../vertical";

// Kevin's "separate tests for landlord derived metrics": the per-unit figures are
// worked out here, from the engine's forecast and the unit count it never sees.

const START = 2026;

// The 3-component test building: water heaters overdue, a roof in 2030 and condensers in 2033.
const building: Component[] = [
  { id: "roof", category: "Roofing", name: "Roof", quantity: 1, installYear: 2008, usefulLifeYears: 22, replacementCostEach: 36000 },
  { id: "wh", category: "Plumbing", name: "Water heaters", quantity: 24, installYear: 2014, usefulLifeYears: 10, replacementCostEach: 1400 },
  { id: "hvac", category: "HVAC", name: "Condensers", quantity: 12, installYear: 2019, usefulLifeYears: 14, replacementCostEach: 4500 },
];

describe("monthly reserve per unit", () => {
  it("divides the monthly reserve by the unit count, unrounded", () => {
    expect(landlordMetrics({ monthlyReserve: 90000 / 84 }, { unitCount: 24 })).toEqual({ monthlyReservePerUnit: 90000 / 84 / 24 });
    expect(landlordForecast(building, 24, START).monthlyReservePerUnit).toBe(90000 / 84 / 24);
  });

  it("allows a fractional unit count, as the calculator does", () => {
    expect(landlordMetrics({ monthlyReserve: 1000 }, { unitCount: 2.5 }).monthlyReservePerUnit).toBe(400);
  });

  it("is null with zero units, and 0 with units but nothing to save for", () => {
    expect(landlordMetrics({ monthlyReserve: 1000 }, { unitCount: 0 }).monthlyReservePerUnit).toBeNull();
    expect(landlordForecast(building, 0, START).monthlyReservePerUnit).toBeNull();
    expect(landlordForecast([], 10, START).monthlyReservePerUnit).toBe(0);
  });

  it("is Infinity when the reserve overflows, as the calculator shows today", () => {
    expect(landlordMetrics({ monthlyReserve: Infinity }, { unitCount: 12 }).monthlyReservePerUnit).toBe(Infinity);
  });

  it("refuses a negative or unreadable unit count", () => {
    for (const unitCount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertUnitCount(unitCount)).toThrow(new RangeError("Unit count can't be negative."));
      expect(() => landlordMetrics({ monthlyReserve: 0 }, { unitCount })).toThrow("Unit count can't be negative.");
    }
    expect(() => assertUnitCount(0)).not.toThrow();
  });
});

describe("per unit across properties", () => {
  const group = (id: string, components: Component[], unitCount: number): VerticalGroup<LandlordFacts> => {
    const g: AssetGroup = { id, name: id, components };
    const result: ForecastResult = landlordForecast(components, unitCount, START);
    return { group: g, result, facts: { unitCount } };
  };
  const roof = (installYear: number): Component[] => [
    { id: "r", category: "Roofing", name: "Roof", quantity: 1, installYear, usefulLifeYears: 20, replacementCostEach: 120000 },
  ];

  it("weights by units: the reserves of properties with units over all their units", () => {
    const a = group("a", building, 24);
    const b = group("b", roof(2016), 10); // 2036: $1,000 a month
    const m = portfolioMetrics([a, b]);
    expect(m.perUnit).toBe((a.result.monthlyReserve + b.result.monthlyReserve) / 34);
    expect(m.missingUnitIds).toEqual([]);
  });

  it("leaves out properties without units, and lists the ones that have a reserve, in order", () => {
    const withUnits = group("with", roof(2016), 10);
    const noReserve = group("quiet", [], 0);
    const missing1 = group("m1", roof(2016), 0);
    const missing2 = group("m2", building, 0);
    const m = portfolioMetrics([missing2, withUnits, noReserve, missing1]);
    expect(m.perUnit).toBe(withUnits.result.monthlyReserve / 10);
    expect(m.missingUnitIds).toEqual(["m2", "m1"]);
  });

  it("is null when no property has units", () => {
    expect(portfolioMetrics([group("a", building, 0)]).perUnit).toBeNull();
    expect(portfolioMetrics([])).toEqual({ perUnit: null, missingUnitIds: [] });
  });
});
