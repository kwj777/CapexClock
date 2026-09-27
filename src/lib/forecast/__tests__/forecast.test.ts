import {
  atRiskItems,
  computeForecast,
  endOfLifeYear,
  replacementYears,
  validateComponent,
  type ForecastComponent,
} from "@/lib/forecast";

const START = 2026;
const END = 2035;

function component(overrides: Partial<ForecastComponent> = {}): ForecastComponent {
  return {
    id: "c1",
    category: "Plumbing",
    name: "Tank water heater",
    quantity: 1,
    installYear: 2020,
    usefulLifeYears: 10,
    replacementCostEach: 1000,
    ...overrides,
  };
}

describe("replacement year calculation", () => {
  it("replaces at install year + useful life", () => {
    const c = component({ installYear: 2020, usefulLifeYears: 10 });
    expect(endOfLifeYear(c)).toBe(2030);
    expect(replacementYears(c, START, END)).toEqual([2030]);
  });

  it("includes a replacement that falls exactly on the first year", () => {
    const c = component({ installYear: 2016, usefulLifeYears: 10 });
    expect(replacementYears(c, START, END)).toEqual([2026]);
  });

  it("includes a replacement on the last year of the window and excludes the year after", () => {
    expect(replacementYears(component({ installYear: 2025, usefulLifeYears: 10 }), START, END)).toEqual([2035]);
    expect(replacementYears(component({ installYear: 2026, usefulLifeYears: 10 }), START, END)).toEqual([]);
  });

  it("pulls an overdue component into the first year, then repeats from there", () => {
    const c = component({ installYear: 2005, usefulLifeYears: 8 }); // end of life 2013
    expect(replacementYears(c, START, END)).toEqual([2026, 2034]);
  });

  it("returns nothing when end of life is beyond the window", () => {
    const c = component({ installYear: 2024, usefulLifeYears: 25 });
    expect(replacementYears(c, START, END)).toEqual([]);
  });
});

describe("multiple replacement cycles within 10 years", () => {
  it("repeats every useful-life years", () => {
    const c = component({ installYear: 2023, usefulLifeYears: 4 }); // 2027, 2031, 2035
    expect(replacementYears(c, START, END)).toEqual([2027, 2031, 2035]);
  });

  it("replaces a 1-year item every year", () => {
    const c = component({ installYear: 2025, usefulLifeYears: 1 });
    expect(replacementYears(c, START, END)).toHaveLength(10);
  });

  it("counts every cycle in the totals", () => {
    const c = component({ installYear: 2021, usefulLifeYears: 5, quantity: 2, replacementCostEach: 500 });
    const f = computeForecast({ startYear: START, unitCount: 2, components: [c] });
    // 2026 and 2031, $1,000 each time
    expect(f.years.find((y) => y.year === 2026)?.total).toBe(1000);
    expect(f.years.find((y) => y.year === 2031)?.total).toBe(1000);
    expect(f.total).toBe(2000);
  });
});

describe("scenario toggle", () => {
  it("replace now puts the first replacement in year one and restarts the cycle", () => {
    const c = component({ installYear: 2020, usefulLifeYears: 6, scenario: "replace_now" });
    expect(replacementYears(c, START, END)).toEqual([2026, 2032]);
  });

  it("run to failure is the default", () => {
    const c = component({ installYear: 2020, usefulLifeYears: 6 });
    expect(replacementYears(c, START, END)).toEqual([2026, 2032]);
    const later = component({ installYear: 2022, usefulLifeYears: 6 });
    expect(replacementYears(later, START, END)).toEqual([2028, 2034]);
    expect(replacementYears({ ...later, scenario: "replace_now" }, START, END)).toEqual([2026, 2032]);
  });
});

describe("reserve totals and per-unit math", () => {
  const components: ForecastComponent[] = [
    component({ id: "roof", category: "Roofing", name: "Roof", quantity: 1, installYear: 2008, usefulLifeYears: 22, replacementCostEach: 36000 }), // 2030
    component({ id: "wh", category: "Plumbing", name: "Water heaters", quantity: 24, installYear: 2014, usefulLifeYears: 10, replacementCostEach: 1400 }), // overdue: 2026
    component({ id: "hvac", category: "HVAC", name: "Condensers", quantity: 12, installYear: 2019, usefulLifeYears: 14, replacementCostEach: 4500 }), // 2033
  ];
  const f = computeForecast({ startYear: START, unitCount: 24, components });

  it("totals each year and category", () => {
    const y2026 = f.years[0];
    expect(y2026.year).toBe(2026);
    expect(y2026.total).toBe(33600);
    expect(y2026.byCategory).toEqual({ Plumbing: 33600 });
    expect(f.years.find((y) => y.year === 2030)?.byCategory).toEqual({ Roofing: 36000 });
    expect(f.years.find((y) => y.year === 2033)?.total).toBe(54000);
  });

  it("totals the whole window", () => {
    expect(f.total).toBe(33600 + 36000 + 54000);
    expect(f.years).toHaveLength(10);
    expect(f.endYear).toBe(2035);
  });

  it("monthly reserve is the 10-year total over 120 months", () => {
    expect(f.monthlyReserve).toBeCloseTo(123600 / 120, 6); // $1,030
  });

  it("per-unit reserve divides by unit count", () => {
    expect(f.monthlyReservePerUnit).toBeCloseTo(1030 / 24, 6);
  });

  it("per-unit reserve is null with zero units", () => {
    expect(computeForecast({ startYear: START, unitCount: 0, components }).monthlyReservePerUnit).toBeNull();
  });

  it("marks only the year-one replacement of an overdue item as overdue", () => {
    const wh = f.years.flatMap((y) => y.replacements).filter((r) => r.componentId === "wh");
    expect(wh.map((r) => [r.year, r.overdue])).toEqual([[2026, true]]);
  });

  it("returns zeros for an empty property", () => {
    const empty = computeForecast({ startYear: START, unitCount: 10, components: [] });
    expect(empty.total).toBe(0);
    expect(empty.monthlyReserve).toBe(0);
    expect(empty.monthlyReservePerUnit).toBe(0);
    expect(empty.atRisk).toEqual([]);
  });

  it("supports a custom window length", () => {
    const five = computeForecast({ startYear: START, years: 5, unitCount: 24, components });
    expect(five.endYear).toBe(2030);
    expect(five.total).toBe(33600 + 36000);
    expect(five.monthlyReserve).toBeCloseTo(69600 / 60, 6);
  });
});

describe("at-risk list", () => {
  it("includes items past end of life or within 2 years, most urgent first", () => {
    const items = atRiskItems(
      [
        component({ id: "a", name: "A", installYear: 2017, usefulLifeYears: 10 }), // 2027: 1 year
        component({ id: "b", name: "B", installYear: 2010, usefulLifeYears: 10 }), // 2020: overdue
        component({ id: "c", name: "C", installYear: 2018, usefulLifeYears: 10 }), // 2028: 2 years
        component({ id: "d", name: "D", installYear: 2019, usefulLifeYears: 10 }), // 2029: 3 years, excluded
      ],
      START,
    );
    expect(items.map((i) => [i.componentId, i.yearsRemaining, i.status])).toEqual([
      ["b", -6, "overdue"],
      ["a", 1, "due_soon"],
      ["c", 2, "due_soon"],
    ]);
  });

  it("carries the estimate flag", () => {
    const [item] = atRiskItems([component({ installYear: 2016, installYearIsEstimate: true })], START);
    expect(item.installYearIsEstimate).toBe(true);
  });
});

describe("validation", () => {
  it("accepts a normal component", () => {
    expect(validateComponent(component())).toEqual([]);
  });

  it.each([
    [{ quantity: 0 }, "Quantity"],
    [{ usefulLifeYears: 0 }, "Useful life"],
    [{ usefulLifeYears: 2.5 }, "Useful life"],
    [{ installYear: 2010.5 }, "Install year"],
    [{ replacementCostEach: -1 }, "Replacement cost"],
  ])("rejects %o", (overrides, message) => {
    expect(validateComponent(component(overrides)).join(" ")).toContain(message);
  });

  it("throws instead of looping forever on a zero useful life", () => {
    expect(() => replacementYears(component({ usefulLifeYears: 0 }), START, END)).toThrow(RangeError);
  });
});
