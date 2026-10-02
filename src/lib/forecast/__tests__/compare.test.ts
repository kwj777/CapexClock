import { compareReplaceNow, computeForecast, type ForecastComponent, type ForecastInput } from "@/lib/forecast";

const START = 2026;

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

// Past end of life (2016), due this year, due in 2027, due in 2028, and not at risk (2031).
const overdue = component({ id: "fridge", name: "Refrigerator", installYear: 2003, usefulLifeYears: 13, replacementCostEach: 1100, quantity: 12 });
const dueNow = component({ id: "heater", name: "Tank water heater", installYear: 2016, usefulLifeYears: 10, replacementCostEach: 1400, quantity: 12 });
const dueNextYear = component({ id: "seal", name: "Parking lot seal coat", installYear: 2023, usefulLifeYears: 4, replacementCostEach: 0.25, quantity: 8000 });
const dueIn2 = component({ id: "carpet", name: "Carpet", installYear: 2020, usefulLifeYears: 8, replacementCostEach: 4, quantity: 9600 });
const later = component({ id: "roof", name: "Roof", category: "Roofing", installYear: 2008, usefulLifeYears: 23, replacementCostEach: 38000 });

function input(components: ForecastComponent[], unitCount = 12): ForecastInput {
  return { startYear: START, unitCount, components };
}

describe("replace everything at risk now", () => {
  const all = [overdue, dueNow, dueNextYear, dueIn2, later];

  it("compares every at-risk item, most urgent first, and leaves the rest alone", () => {
    const result = compareReplaceNow(input(all));
    expect(result.items.map((i) => i.componentId)).toEqual(["fridge", "heater", "seal", "carpet"]);
    expect(result.chosen).toEqual(["fridge", "heater", "seal", "carpet"]);
    expect(result.alreadyReplacing).toBe(0);
  });

  it("matches the forecast as it stands when there's no emergency extra", () => {
    const f = computeForecast(input(all));
    const { asPlanned } = compareReplaceNow(input(all));
    expect(asPlanned).toEqual({
      neededNow: f.neededNow,
      total: f.total,
      monthlyReserve: f.monthlyReserve,
      monthlyReservePerUnit: f.monthlyReservePerUnit,
    });
  });

  it("matches running the forecast with those rows set to replace now", () => {
    const applied = all.map((c) => (c.id === "roof" ? c : { ...c, scenario: "replace_now" as const }));
    const f = computeForecast(input(applied));
    const { replaceNow } = compareReplaceNow(input(all));
    expect(replaceNow.neededNow).toBe(f.neededNow);
    expect(replaceNow.total).toBe(f.total);
    expect(replaceNow.monthlyReserve).toBe(f.monthlyReserve);
    expect(replaceNow.monthlyReservePerUnit).toBe(f.monthlyReservePerUnit);
  });

  it("moves the items due in the next 2 years into this year's cash", () => {
    const { asPlanned, replaceNow } = compareReplaceNow(input(all));
    // 2027's seal coat ($2,000) and 2028's carpet ($38,400) join this year's fridges and heaters.
    expect(asPlanned.neededNow).toBe(12 * 1100 + 12 * 1400);
    expect(replaceNow.neededNow).toBe(asPlanned.neededNow + 2000 + 38400);
  });

  it("lowers the monthly reserve, because the moved items are paid now instead of saved for", () => {
    const { asPlanned, replaceNow } = compareReplaceNow(input(all));
    expect(replaceNow.monthlyReserve).toBeLessThan(asPlanned.monthlyReserve);
    expect(replaceNow.monthlyReservePerUnit).toBeCloseTo(replaceNow.monthlyReserve / 12, 10);
  });

  it("changes nothing for items past end of life or due this year: they're in year one either way", () => {
    const { items, asPlanned, replaceNow } = compareReplaceNow(input([overdue, dueNow, later]));
    expect(items).toHaveLength(2);
    expect(replaceNow).toEqual(asPlanned);
  });

  it("can add a replacement to the 10-year total when replacing early pulls the next one into the window", () => {
    // Due 2027 on a 9-year life: 2027 and 2036 as planned, 2026 and 2035 if replaced now.
    const boiler = component({ id: "boiler", name: "Boiler", installYear: 2018, usefulLifeYears: 9, replacementCostEach: 20000 });
    const { asPlanned, replaceNow } = compareReplaceNow(input([boiler]));
    expect(asPlanned.total).toBe(20000);
    expect(replaceNow.total).toBe(40000);
  });

  it("leaves out items already set to replace now, which are the same on both sides", () => {
    const planned = { ...dueIn2, scenario: "replace_now" as const };
    const result = compareReplaceNow(input([overdue, planned, later]));
    expect(result.items.map((i) => i.componentId)).toEqual(["fridge"]);
    expect(result.alreadyReplacing).toBe(1);
    expect(result.replaceNow).toEqual(result.asPlanned);
  });

  it("has nothing to compare when nothing is at risk", () => {
    const result = compareReplaceNow(input([later]));
    expect(result.items).toEqual([]);
    expect(result.chosen).toEqual([]);
    expect(result.replaceNow).toEqual(result.asPlanned);
  });

  it("replaces only the chosen items when given a choice, ignoring ids that aren't at risk", () => {
    const result = compareReplaceNow(input(all), { only: new Set(["seal", "roof", "gone"]) });
    expect(result.items).toHaveLength(4);
    expect(result.chosen).toEqual(["seal"]);
    expect(result.replaceNow.neededNow).toBe(result.asPlanned.neededNow + 2000);
  });

  it("is the forecast as it stands on both sides when nothing is chosen", () => {
    const result = compareReplaceNow(input(all), { only: new Set() });
    expect(result.chosen).toEqual([]);
    expect(result.replaceNow).toEqual(result.asPlanned);
  });

  it("carries the estimate flag, so guessed install years can be listed apart", () => {
    const guessed = { ...dueIn2, installYearIsEstimate: true };
    const { items } = compareReplaceNow(input([overdue, guessed]));
    expect(items.map((i) => [i.componentId, i.installYearIsEstimate])).toEqual([
      ["fridge", false],
      ["carpet", true],
    ]);
  });

  it("has no per-unit figure without a unit count", () => {
    const { asPlanned, replaceNow } = compareReplaceNow(input(all, 0));
    expect(asPlanned.monthlyReservePerUnit).toBeNull();
    expect(replaceNow.monthlyReservePerUnit).toBeNull();
  });

  it("doesn't change the components it was given", () => {
    const components = all.map((c) => ({ ...c }));
    compareReplaceNow(input(components), { emergencyPercent: 20 });
    expect(components).toEqual(all);
  });
});

describe("emergency replacements cost more", () => {
  it("adds the extra to each chosen item's next replacement on the as-planned side only", () => {
    const plain = compareReplaceNow(input([dueNextYear, dueIn2]));
    const extra = compareReplaceNow(input([dueNextYear, dueIn2]), { emergencyPercent: 25 });
    expect(extra.replaceNow).toEqual(plain.replaceNow);
    // The seal coat's 2027 and the carpet's 2028 replacements cost 25% more; later ones don't.
    expect(extra.asPlanned.total).toBeCloseTo(plain.asPlanned.total + 0.25 * (2000 + 38400), 6);
    expect(extra.asPlanned.neededNow).toBe(plain.asPlanned.neededNow);
    expect(extra.asPlanned.monthlyReserve).toBeGreaterThan(plain.asPlanned.monthlyReserve);
  });

  // Awaiting Kevin's answer on whether the extra belongs on items paid this year
  // either way (see emergencyPercent in compare.ts). Change this test if he says no.
  it("makes waiting on an overdue item cost more this year", () => {
    const plain = compareReplaceNow(input([overdue]));
    const extra = compareReplaceNow(input([overdue]), { emergencyPercent: 10 });
    expect(extra.asPlanned.neededNow).toBeCloseTo(plain.asPlanned.neededNow * 1.1, 6);
    expect(extra.replaceNow.neededNow).toBe(plain.asPlanned.neededNow);
    // This year's costs are never in the monthly reserve.
    expect(extra.asPlanned.monthlyReserve).toBe(plain.asPlanned.monthlyReserve);
  });

  it("leaves items that aren't chosen alone, since they'd wait on both sides", () => {
    const plain = compareReplaceNow(input([dueNextYear, dueIn2]), { only: new Set(["seal"]) });
    const extra = compareReplaceNow(input([dueNextYear, dueIn2]), { only: new Set(["seal"]), emergencyPercent: 50 });
    expect(extra.asPlanned.total).toBeCloseTo(plain.asPlanned.total + 0.5 * 2000, 6);
  });

  it("treats 0, a missing value or a negative one as no extra", () => {
    const plain = compareReplaceNow(input([overdue, dueIn2]));
    expect(compareReplaceNow(input([overdue, dueIn2]), { emergencyPercent: 0 })).toEqual(plain);
    expect(compareReplaceNow(input([overdue, dueIn2]), { emergencyPercent: -10 })).toEqual(plain);
  });

  it("is never part of the forecast itself", () => {
    const before = computeForecast(input([overdue, dueIn2]));
    compareReplaceNow(input([overdue, dueIn2]), { emergencyPercent: 30 });
    expect(computeForecast(input([overdue, dueIn2]))).toEqual(before);
  });
});
