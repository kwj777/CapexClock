import { computeForecast, inflationFactor, nextReplacementReserve, projectReplacements, summarizeForecast } from "..";
import { BUILDING, component, mulberry32, randomComponents, START } from "./fixtures";

describe("inflation", () => {
  it("off reproduces the forecast bit for bit", () => {
    const rand = mulberry32(11);
    for (let i = 0; i < 100; i++) {
      const components = randomComponents(rand, START);
      const plain = computeForecast({ startYear: START, components });
      const zero = computeForecast({ startYear: START, components, inflationRate: 0 });
      expect(zero).toEqual(plain);
      zero.reserveYearTotals.forEach((t, k) => expect(Object.is(t, plain.reserveYearTotals[k])).toBe(true));
      expect(Object.is(zero.monthlyReserve, plain.monthlyReserve)).toBe(true);
    }
  });

  it("gives a factor of exactly 1 at the start year, and at rate 0", () => {
    expect(inflationFactor(0.03, 0)).toBe(1);
    expect(inflationFactor(0, 40)).toBe(1);
    expect(inflationFactor(0.03, 2)).toBe(1.03 * 1.03);
  });

  it("compounds a replacement's cost each year from the start year", () => {
    const later = component({ installYear: 2020, replacementCostEach: 1000 }); // 2030, then 2040
    const [first, second] = projectReplacements({ startYear: START, components: [later], inflationRate: 0.03 });
    expect(first.baseCost).toBe(1000);
    expect(first.cost).toBe(1000 * Math.pow(1.03, 4));
    expect(second.cost).toBe(1000 * Math.pow(1.03, 14));
  });

  it("keeps first-year costs in today's dollars", () => {
    const f = computeForecast({ startYear: START, components: BUILDING, inflationRate: 0.03 });
    expect(f.neededNow).toBe(33600);
  });

  it("can move the tightest year", () => {
    const flat = computeForecast({ startYear: START, components: BUILDING });
    const inflated = computeForecast({ startYear: START, components: BUILDING, inflationRate: 0.03 });
    expect(flat.tightestYear).toBe(2033);
    expect(inflated.tightestYear).toBe(2056);
    expect(inflated.monthlyReserve).toBeCloseTo(1312.28, 2);
    expect(inflated.monthlyReserve).toBeGreaterThan(flat.monthlyReserve);
  });

  it("inflates adjustments once per year, after summing them", () => {
    const f = summarizeForecast([], {
      startYear: START,
      inflationRate: 0.1,
      adjustments: [
        { year: 2028, amount: 300 },
        { year: 2028, amount: 700 },
        { year: START, amount: 50 },
      ],
    });
    expect(f.years[2].adjustment).toBe(1000 * Math.pow(1.1, 2));
    expect(f.years[2].total).toBe(1000 * Math.pow(1.1, 2));
    expect(f.years[0].adjustment).toBe(50);
  });

  it("applies to one component's reserve", () => {
    const later = component({ installYear: 2020, replacementCostEach: 1200 }); // 2030
    expect(nextReplacementReserve(later, START, { inflationRate: 0.03 }).monthly).toBe((1200 * Math.pow(1.03, 4)) / 48);
    const due = component({ installYear: 2010, replacementCostEach: 1200 });
    expect(nextReplacementReserve(due, START, { inflationRate: 0.03 })).toEqual({
      neededNow: 1200,
      monthly: (1200 * Math.pow(1.03, 10)) / 120,
      savingFor: 2036,
    });
  });

  it("refuses a rate that isn't a decimal from 0 to 1", () => {
    for (const inflationRate of [-0.01, 1.01, 3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => computeForecast({ startYear: START, components: [], inflationRate })).toThrow(
        "Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%.",
      );
    }
    expect(computeForecast({ startYear: START, components: BUILDING, inflationRate: 1 }).neededNow).toBe(33600);
  });
});
