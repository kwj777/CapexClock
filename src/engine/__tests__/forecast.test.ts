import {
  compareScenarios,
  componentLife,
  computeForecast,
  findAtRisk,
  forecastAssetGroups,
  nextReplacementReserve,
  nextReplacementYears,
  projectReplacements,
  rollupForecasts,
  summarizeForecast,
  validateComponent,
  withScenario,
} from "..";
import type { Component, ForecastOptions } from "..";
import { BUILDING, component, mulberry32, randomComponents, START } from "./fixtures";

describe("a forecast end to end", () => {
  const f = computeForecast({ startYear: START, components: BUILDING });

  it("gives the totals, needed now and the monthly reserve", () => {
    expect(f.startYear).toBe(2026);
    expect(f.endYear).toBe(2035);
    expect(f.horizonYears).toBe(10);
    expect(f.years.map((y) => y.total)).toEqual([33600, 0, 0, 0, 36000, 0, 0, 54000, 0, 0]);
    expect(f.horizonTotal).toBe(123600);
    expect(f.neededNow).toBe(33600);
    expect(f.monthlyReserve).toBe(90000 / 84);
    expect(f.reserveFromYear).toBe(2027);
    expect(f.reserveThroughYear).toBe(2056);
    expect(f.tightestYear).toBe(2033);
    expect(f.savingAhead).toEqual([]);
  });

  it("lists the horizon's replacements in year order, the at-risk list and each next replacement", () => {
    expect(f.replacements.map((r) => [r.componentId, r.year, r.overdue])).toEqual([
      ["wh", 2026, true],
      ["roof", 2030, false],
      ["hvac", 2033, false],
    ]);
    expect(f.replacements).toEqual(f.years.flatMap((y) => y.replacements));
    expect(f.atRisk.map((r) => r.componentId)).toEqual(["wh"]);
    expect(f.nextReplacements).toEqual([
      { componentId: "roof", year: 2030, overdue: false },
      { componentId: "wh", year: 2026, overdue: true },
      { componentId: "hvac", year: 2033, overdue: false },
    ]);
  });

  it("is the summary of its own projection plus those lists", () => {
    const input = { startYear: START, components: BUILDING };
    const summary = summarizeForecast(projectReplacements(input), input);
    expect(f).toEqual({
      ...summary,
      replacements: summary.years.flatMap((y) => y.replacements),
      atRisk: findAtRisk(BUILDING, START),
      nextReplacements: nextReplacementYears(BUILDING, START),
    });
  });

  it("has a fixed set of fields", () => {
    expect(Object.keys(f).sort()).toEqual([
      "atRisk",
      "carriedForward",
      "contingencyRate",
      "currentReserveBalance",
      "endYear",
      "horizonTotal",
      "horizonYears",
      "monthlyReserve",
      "monthlyReserveBeforeContingency",
      "neededNow",
      "nextReplacements",
      "replacements",
      "reserveFromYear",
      "reserveThroughYear",
      "reserveYearTotals",
      "savingAhead",
      "shortfallNow",
      "startYear",
      "tightestYear",
      "years",
    ]);
    expect(Object.keys(f.years[0]).sort()).toEqual(["adjustment", "byCategory", "replacements", "total", "year"]);
  });

  it("returns zeros for no components", () => {
    const empty = computeForecast({ startYear: START, components: [] });
    expect(empty.years).toHaveLength(10);
    expect(empty.horizonTotal).toBe(0);
    expect(empty.neededNow).toBe(0);
    expect(empty.monthlyReserve).toBe(0);
    expect(empty.tightestYear).toBeNull();
    expect(empty.atRisk).toEqual([]);
    expect(empty.nextReplacements).toEqual([]);
  });

  it("takes a custom horizon", () => {
    const five = computeForecast({ startYear: START, components: BUILDING, horizonYears: 5 });
    expect(five.years).toHaveLength(5);
    expect(five.endYear).toBe(2030);
    expect(five.horizonTotal).toBe(69600);
    // The reserve still looks 30 years ahead, so the condensers after the horizon set it.
    expect(five.monthlyReserve).toBe(90000 / 84);
    expect(five.savingAhead.map((r) => r.componentId)).toEqual(["hvac"]);
  });

  it("refuses a bad component, naming it", () => {
    expect(() => computeForecast({ startYear: START, components: [component({ name: "Boiler", usefulLifeYears: 0 })] })).toThrow(
      'Invalid component "Boiler": Useful life must be a whole number of years from 1 to 100.',
    );
  });
});

describe("the next replacement of each component", () => {
  it("is in input order, not limited to the horizon", () => {
    expect(
      nextReplacementYears(
        [component({ id: "far", installYear: 2020, usefulLifeYears: 60 }), component({ id: "over", installYear: 2000 }), component({ id: "now", installYear: 2024, scenario: "replace_now" })],
        START,
      ),
    ).toEqual([
      { componentId: "far", year: 2080, overdue: false },
      { componentId: "over", year: 2026, overdue: true },
      { componentId: "now", year: 2026, overdue: false },
    ]);
  });
});

describe("any valid input (seeded)", () => {
  const HUGE = [0, 0.01, 1, 1e6, 1e100, 1e200, Number.MAX_VALUE];

  function wildComponents(rand: () => number): Component[] {
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
    const base = randomComponents(rand, START);
    return base.map((c) =>
      rand() < 0.3 ? { ...c, quantity: pick(HUGE.filter((q) => q > 0)), replacementCostEach: pick(HUGE) } : c,
    );
  }

  function wildOptions(rand: () => number): ForecastOptions {
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const startYear = int(1800, 2200);
    return {
      startYear,
      horizonYears: rand() < 0.5 ? undefined : int(1, 100),
      reserveHorizonYears: rand() < 0.5 ? undefined : int(0, 100),
      atRiskYears: rand() < 0.5 ? undefined : int(0, 100),
      inflationRate: rand() < 0.5 ? undefined : rand() < 0.2 ? 1 : rand() * 0.1,
      currentReserveBalance: rand() < 0.5 ? undefined : HUGE[int(0, HUGE.length - 1)],
      adjustments:
        rand() < 0.7
          ? undefined
          : Array.from({ length: int(0, 4) }, () => ({ year: startYear + int(0, 120), amount: HUGE[int(0, HUGE.length - 1)] })),
    };
  }

  it("never makes the engine throw, even when sums overflow", () => {
    const rand = mulberry32(20261003);
    let infinite = 0;
    for (let i = 0; i < 400; i++) {
      const options = wildOptions(rand);
      const components = wildComponents(rand).filter((c) => validateComponent(c).length === 0);
      const f = computeForecast({ ...options, components });
      if (f.monthlyReserve === Number.POSITIVE_INFINITY || f.horizonTotal === Number.POSITIVE_INFINITY) infinite++;
      expect(f.monthlyReserve).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(f.monthlyReserve)).toBe(false);
      expect(Number.isNaN(f.horizonTotal)).toBe(false);
      expect(f.years).toHaveLength(options.horizonYears ?? 10);

      const ids = new Set(components.filter(() => rand() < 0.5).map((c) => c.id));
      compareScenarios({ ...options, components }, { ...options, components: withScenario(components, ids, "replace_now") });
      rollupForecasts(forecastAssetGroups([{ id: "g", name: "G", components }], options).map((g) => g.result));
      findAtRisk(components, options.startYear, options.atRiskYears);
      for (const c of components) {
        componentLife(c, options.startYear);
        nextReplacementReserve(c, options.startYear, { inflationRate: options.inflationRate });
      }
    }
    expect(infinite).toBeGreaterThan(0);
  });
});
