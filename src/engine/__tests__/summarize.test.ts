import { computeForecast, projectReplacements, summarizeForecast, type Replacement } from "..";
import { BUILDING, component, START } from "./fixtures";

const replacement = (overrides: Partial<Replacement>): Replacement => ({
  componentId: "x",
  name: "X",
  category: "Other",
  year: START,
  baseCost: 100,
  cost: 100,
  overdue: false,
  estimated: { quantity: false, installYear: false, usefulLife: false, replacementCost: false },
  ...overrides,
});

describe("yearly totals", () => {
  const f = computeForecast({ startYear: START, components: BUILDING });

  it("totals each year and category, one entry per horizon year", () => {
    expect(f.years).toHaveLength(10);
    expect(f.years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
    expect(f.years[0]).toMatchObject({ total: 33600, byCategory: { Plumbing: 33600 }, adjustment: 0 });
    expect(f.years[4].byCategory).toEqual({ Roofing: 36000 });
    expect(f.years[7].total).toBe(54000);
    expect(f.years[1]).toMatchObject({ total: 0, byCategory: {}, replacements: [] });
  });

  it("totals the horizon and reports the first year as needed now", () => {
    expect(f.horizonTotal).toBe(33600 + 36000 + 54000);
    expect(f.neededNow).toBe(33600);
    expect(f.endYear).toBe(2035);
    expect(f.horizonYears).toBe(10);
    expect(f.replacements.map((r) => r.componentId)).toEqual(["wh", "roof", "hvac"]);
  });

  it("keeps categories in first-appearance order, with a key for a zero cost", () => {
    const s = summarizeForecast(
      [replacement({ category: "B", cost: 0 }), replacement({ category: "A", cost: 5 }), replacement({ category: "B", cost: 7 })],
      { startYear: START },
    );
    expect(Object.entries(s.years[0].byCategory)).toEqual([
      ["B", 7],
      ["A", 5],
    ]);
  });

  it("ignores replacements after the projection and refuses ones before the start year", () => {
    const s = summarizeForecast([replacement({ year: START + 31 })], { startYear: START });
    expect(s.reserveYearTotals.every((t) => t === 0)).toBe(true);
    expect(() => summarizeForecast([replacement({ year: START - 1 })], { startYear: START })).toThrow(
      "Replacement year must be a whole year from the start year on.",
    );
    expect(() => summarizeForecast([replacement({ year: START + 0.5 })], { startYear: START })).toThrow(RangeError);
  });

  it("gives zeros for no components", () => {
    const empty = computeForecast({ startYear: START, components: [] });
    expect([empty.horizonTotal, empty.neededNow, empty.monthlyReserve, empty.tightestYear]).toEqual([0, 0, 0, null]);
    expect(empty.atRisk).toEqual([]);
    expect(empty.savingAhead).toEqual([]);
  });
});

describe("adjustments", () => {
  it("adds one-off amounts to their year's total after its replacements, not to a category", () => {
    const f = computeForecast({
      startYear: START,
      components: BUILDING,
      adjustments: [
        { year: 2030, amount: 1000 },
        { year: 2030, amount: 500 },
        { year: 2027, amount: 0 },
        { year: 2090, amount: 9 },
      ],
    });
    expect(f.years[4]).toMatchObject({ total: 37500, adjustment: 1500, byCategory: { Roofing: 36000 } });
    expect(f.years[1].adjustment).toBe(0);
    expect(f.horizonTotal).toBe(33600 + 37500 + 54000);
  });

  it("lets an overflowing amount through as Infinity", () => {
    const f = computeForecast({ startYear: START, components: [], adjustments: [{ year: 2028, amount: Number.POSITIVE_INFINITY }] });
    expect(f.monthlyReserve).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("the reserve horizon", () => {
  it("counts a bill in exactly 30 years and not one in 31", () => {
    const at30 = computeForecast({ startYear: START, components: [component({ installYear: 2016, usefulLifeYears: 40, replacementCostEach: 60000 })] });
    expect(at30.monthlyReserve).toBe(60000 / 360);
    expect(at30.tightestYear).toBe(2056);
    expect(at30.reserveThroughYear).toBe(2056);
    expect(at30.reserveFromYear).toBe(2027);
    const at31 = computeForecast({ startYear: START, components: [component({ installYear: 2017, usefulLifeYears: 40, replacementCostEach: 60000 })] });
    expect(at31.monthlyReserve).toBe(0);
  });

  it("still sees 30 years with a 1-year horizon", () => {
    const f = computeForecast({ startYear: START, horizonYears: 1, components: BUILDING });
    expect(f.years).toHaveLength(1);
    expect(f.horizonTotal).toBe(33600);
    expect(f.monthlyReserve).toBe(90000 / 84);
  });

  it("follows a horizon longer than 31 years", () => {
    for (const horizonYears of [31, 32, 45]) {
      const f = computeForecast({ startYear: START, horizonYears, components: BUILDING });
      expect(f.reserveYearTotals).toHaveLength(Math.max(horizonYears, 31));
      expect(f.reserveThroughYear).toBe(START + Math.max(horizonYears - 1, 30));
    }
  });

  it("with a reserve horizon of 0 sees only the horizon", () => {
    const f = computeForecast({ startYear: START, horizonYears: 5, reserveHorizonYears: 0, components: BUILDING });
    expect(f.reserveYearTotals).toHaveLength(5);
    expect(f.monthlyReserve).toBe(36000 / 48);
    expect(computeForecast({ startYear: START, horizonYears: 1, reserveHorizonYears: 0, components: BUILDING }).monthlyReserve).toBe(0);
  });

  it("lists replacements after the horizon that set the reserve, earliest year winning a tie", () => {
    const roof = component({ id: "roof", name: "Roof", installYear: 2014, usefulLifeYears: 23, replacementCostEach: 38000 }); // 2037
    const f = computeForecast({ startYear: START, components: [roof] });
    expect(f.horizonTotal).toBe(0);
    expect(f.monthlyReserve).toBe(38000 / 132);
    expect(f.savingAhead.map((x) => [x.year, x.name, x.cost])).toEqual([[2037, "Roof", 38000]]);
    expect(computeForecast({ startYear: START, components: BUILDING }).savingAhead).toEqual([]);
    // Two years needing the same monthly amount: the earlier one sets it.
    const tie = computeForecast({ startYear: START, components: [component({ installYear: 2017, replacementCostEach: 1200 }), component({ id: "c2", installYear: 2018, replacementCostEach: 1200 })] });
    expect(tie.monthlyReserve).toBe(100);
    expect(tie.tightestYear).toBe(2027);
  });

  it("is always empty with a horizon at least as long as the projection", () => {
    const f = computeForecast({ startYear: START, horizonYears: 31, components: [component({ installYear: 2030, usefulLifeYears: 20 })] });
    expect(f.savingAhead).toEqual([]);
  });

  it("returns every projected year's total", () => {
    const f = computeForecast({ startYear: START, components: BUILDING });
    expect(f.reserveYearTotals).toHaveLength(31);
    expect(f.reserveYearTotals.slice(0, 10)).toEqual(f.years.map((y) => y.total));
  });
});

describe("year totals that overflow", () => {
  it("pass Infinity through instead of throwing", () => {
    const big = component({ installYear: 2000, usefulLifeYears: 30, quantity: 1e200, replacementCostEach: 1e200 });
    const f = computeForecast({ startYear: START, components: [big] });
    expect(f.monthlyReserve).toBe(Number.POSITIVE_INFINITY);
    expect(f.horizonTotal).toBe(Number.POSITIVE_INFINITY);
  });

  it("refuse NaN and negative replacement costs", () => {
    expect(() => summarizeForecast([replacement({ cost: Number.NaN, year: 2027 })], { startYear: START })).toThrow("Year totals must be amounts of 0 or more.");
    expect(() => summarizeForecast([replacement({ cost: -1, year: 2027 })], { startYear: START })).toThrow("Year totals must be amounts of 0 or more.");
  });

  it("summarizes its own projection", () => {
    const input = { startYear: START, components: BUILDING };
    expect(summarizeForecast(projectReplacements(input), input).monthlyReserve).toBe(90000 / 84);
  });
});
