import { isEstimate, nextReplacementYear, nextReplacementYears, projectReplacements, type Component } from "..";
import { component, START } from "./fixtures";

/** Replacement years in the 10-year horizon (the projection runs longer for the reserve). */
const years = (c: Component, horizonYears = 10, reserveHorizonYears = 0) =>
  projectReplacements({ startYear: START, horizonYears, reserveHorizonYears, components: [c] }).map((r) => r.year);

describe("a single replacement cycle", () => {
  it("replaces at install year + useful life", () => {
    expect(years(component({ installYear: 2020, usefulLifeYears: 10 }))).toEqual([2030]);
  });

  it("includes one falling exactly on the first year", () => {
    expect(years(component({ installYear: 2016, usefulLifeYears: 10 }))).toEqual([2026]);
  });

  it("includes the last year of the horizon and not the year after", () => {
    expect(years(component({ installYear: 2025, usefulLifeYears: 10 }))).toEqual([2035]);
    expect(years(component({ installYear: 2026, usefulLifeYears: 10 }))).toEqual([]);
  });

  it("gives nothing when end of life is past the projection", () => {
    expect(years(component({ installYear: 2024, usefulLifeYears: 25 }))).toEqual([]);
  });
});

describe("multiple replacement cycles", () => {
  it("repeats every useful-life years", () => {
    expect(years(component({ installYear: 2023, usefulLifeYears: 4 }))).toEqual([2027, 2031, 2035]);
  });

  it("replaces a 1-year item every year", () => {
    expect(years(component({ installYear: 2025, usefulLifeYears: 1 }))).toHaveLength(10);
  });

  it("projects max(horizon, reserve horizon + 1) years", () => {
    const c = component({ installYear: 2016, usefulLifeYears: 10 });
    expect(projectReplacements({ startYear: START, components: [c] }).map((r) => r.year)).toEqual([2026, 2036, 2046, 2056]);
    expect(years(c, 45, 30)).toEqual([2026, 2036, 2046, 2056, 2066]);
  });
});

describe("components already past end of life", () => {
  it("pulls the first replacement into the start year, then repeats from there", () => {
    const r = projectReplacements({ startYear: START, horizonYears: 10, reserveHorizonYears: 0, components: [component({ installYear: 2005, usefulLifeYears: 8 })] });
    expect(r.map((x) => [x.year, x.overdue])).toEqual([
      [2026, true],
      [2034, false],
    ]);
  });

  it("marks replace-now as overdue only when the item really was", () => {
    const overdue = projectReplacements({ startYear: START, components: [component({ installYear: 2000, scenario: "replace_now" })] });
    expect(overdue[0]).toMatchObject({ year: 2026, overdue: true });
    const notYet = projectReplacements({ startYear: START, components: [component({ installYear: 2022, scenario: "replace_now" })] });
    expect(notYet[0]).toMatchObject({ year: 2026, overdue: false });
    expect(notYet.map((x) => x.year).slice(0, 2)).toEqual([2026, 2036]);
  });

  it("treats due this year as due, not overdue", () => {
    expect(projectReplacements({ startYear: START, components: [component({ installYear: 2016 })] })[0]).toMatchObject({ year: 2026, overdue: false });
  });
});

describe("quantity math", () => {
  it.each([
    [9600, 4, 38400],
    [8000, 0.25, 2000],
    [2.5, 1000, 2500],
    [9600.5, 4, 38402],
  ])("%d × %d = %d, never rounded", (quantity, replacementCostEach, cost) => {
    const [r] = projectReplacements({ startYear: START, components: [component({ installYear: 2016, quantity, replacementCostEach })] });
    expect(r.baseCost).toBe(cost);
    expect(r.cost).toBe(cost);
  });

  it("keeps a replacement that costs nothing", () => {
    const [r] = projectReplacements({ startYear: START, components: [component({ installYear: 2016, replacementCostEach: 0 })] });
    expect(r).toMatchObject({ year: 2026, cost: 0 });
  });
});

describe("order and flags", () => {
  it("sorts by year, then component input order", () => {
    const r = projectReplacements({
      startYear: START,
      horizonYears: 10,
      reserveHorizonYears: 0,
      components: [component({ id: "late", installYear: 2020 }), component({ id: "now", installYear: 2016, usefulLifeYears: 4 }), component({ id: "also", installYear: 2010, usefulLifeYears: 20 })],
    });
    expect(r.map((x) => `${x.componentId}@${x.year}`)).toEqual(["now@2026", "late@2030", "now@2030", "also@2030", "now@2034"]);
  });

  it("spells out every estimate flag", () => {
    const [r] = projectReplacements({ startYear: START, components: [component({ installYear: 2016, estimated: { installYear: true } })] });
    expect(r.estimated).toEqual({ quantity: false, installYear: true, usefulLife: false, replacementCost: false });
  });

  it("calls a component an estimate when any of its inputs is one", () => {
    expect(isEstimate(component())).toBe(false);
    expect(isEstimate(component({ estimated: { installYear: false } }))).toBe(false);
    for (const flag of ["quantity", "installYear", "usefulLife", "replacementCost"] as const) {
      expect(isEstimate(component({ estimated: { [flag]: true } }))).toBe(true);
    }
  });
});

describe("the next replacement year of each component", () => {
  it("is not limited to the horizon and says whether the item is overdue", () => {
    const components = [component({ id: "a", installYear: 2005 }), component({ id: "b", installYear: 2050, usefulLifeYears: 40 }), component({ id: "c", installYear: 2022, scenario: "replace_now" })];
    expect(nextReplacementYears(components, START)).toEqual([
      { componentId: "a", year: 2026, overdue: true },
      { componentId: "b", year: 2090, overdue: false },
      { componentId: "c", year: 2026, overdue: false },
    ]);
    expect(nextReplacementYear(components[1], START)).toBe(2090);
  });

  it("refuses a bad start year or component", () => {
    expect(() => nextReplacementYear(component(), 2026.5)).toThrow("Start year must be a whole year.");
    expect(() => nextReplacementYear(component({ usefulLifeYears: 0 }), START)).toThrow(RangeError);
    expect(() => nextReplacementYears([component()], 0.5)).toThrow("Start year must be a whole year.");
  });
});
