import { assertForecastOptions, computeForecast, projectReplacements, validateComponent } from "..";
import { component, START } from "./fixtures";

const errorOf = (f: () => unknown): string => {
  try {
    f();
    return "";
  } catch (e) {
    expect(e).toBeInstanceOf(RangeError);
    return (e as Error).message;
  }
};

describe("validateComponent", () => {
  it("accepts a normal component, a fractional quantity and a cost of 0", () => {
    expect(validateComponent(component())).toEqual([]);
    expect(validateComponent(component({ quantity: 2.5 }))).toEqual([]);
    expect(validateComponent(component({ replacementCostEach: 0 }))).toEqual([]);
    expect(validateComponent(component({ usefulLifeYears: 100 }))).toEqual([]);
  });

  it.each([
    [{ quantity: 0 }, "Quantity must be greater than zero."],
    [{ quantity: -1 }, "Quantity must be greater than zero."],
    [{ quantity: Number.NaN }, "Quantity must be greater than zero."],
    [{ quantity: Number.POSITIVE_INFINITY }, "Quantity must be greater than zero."],
    [{ installYear: 2010.5 }, "Install year must be a whole year."],
    [{ usefulLifeYears: 0 }, "Useful life must be a whole number of years from 1 to 100."],
    [{ usefulLifeYears: 101 }, "Useful life must be a whole number of years from 1 to 100."],
    [{ usefulLifeYears: 2.5 }, "Useful life must be a whole number of years from 1 to 100."],
    [{ replacementCostEach: -1 }, "Replacement cost can't be negative."],
    [{ replacementCostEach: Number.NaN }, "Replacement cost can't be negative."],
  ])("rejects %o", (overrides, message) => {
    expect(validateComponent(component(overrides))).toEqual([message]);
  });

  it("lists every problem, in a fixed order", () => {
    expect(validateComponent(component({ quantity: 0, installYear: 1.5, usefulLifeYears: 0, replacementCostEach: -1 }))).toEqual([
      "Quantity must be greater than zero.",
      "Install year must be a whole year.",
      "Useful life must be a whole number of years from 1 to 100.",
      "Replacement cost can't be negative.",
    ]);
  });

  it("throws for the first invalid component, naming it", () => {
    const components = [component({ id: "a" }), component({ id: "b", name: "Boiler", quantity: 0, usefulLifeYears: 0 }), component({ id: "c", name: "Roof", quantity: -1 })];
    expect(errorOf(() => projectReplacements({ startYear: START, components }))).toBe(
      'Invalid component "Boiler": Quantity must be greater than zero. Useful life must be a whole number of years from 1 to 100.',
    );
  });
});

describe("forecast options", () => {
  it.each([
    [{ horizonYears: 0 }, "Forecast window must be a whole number of years, at least 1."],
    [{ horizonYears: 2.5 }, "Forecast window must be a whole number of years, at least 1."],
    [{ horizonYears: 101 }, "Forecast window can't be more than 100 years."],
    [{ reserveHorizonYears: -1 }, "Reserve horizon must be a whole number of years from 0 to 100."],
    [{ reserveHorizonYears: 101 }, "Reserve horizon must be a whole number of years from 0 to 100."],
    [{ reserveHorizonYears: 1.5 }, "Reserve horizon must be a whole number of years from 0 to 100."],
    [{ startYear: 2026.5 }, "Start year must be a whole year."],
    [{ inflationRate: -0.01 }, "Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%."],
    [{ inflationRate: 1.01 }, "Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%."],
    [{ inflationRate: 3 }, "Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%."],
    [{ inflationRate: Number.NaN }, "Inflation rate must be a decimal from 0 to 1, like 0.03 for 3%."],
    [{ currentReserveBalance: -1 }, "Current reserve balance must be a dollar amount of 0 or more."],
    [{ currentReserveBalance: Number.POSITIVE_INFINITY }, "Current reserve balance must be a dollar amount of 0 or more."],
    [{ adjustments: [{ year: 2025, amount: 1 }] }, "An adjustment needs a whole year from the start year on and an amount of 0 or more."],
    [{ adjustments: [{ year: 2027.5, amount: 1 }] }, "An adjustment needs a whole year from the start year on and an amount of 0 or more."],
    [{ adjustments: [{ year: 2027, amount: -1 }] }, "An adjustment needs a whole year from the start year on and an amount of 0 or more."],
    [{ adjustments: [{ year: 2027, amount: Number.NaN }] }, "An adjustment needs a whole year from the start year on and an amount of 0 or more."],
    [{ atRiskYears: -1 }, "At-risk window must be a whole number of years from 0 to 100."],
    [{ atRiskYears: 101 }, "At-risk window must be a whole number of years from 0 to 100."],
    [{ atRiskYears: 0.5 }, "At-risk window must be a whole number of years from 0 to 100."],
  ])("refuses %o", (overrides, message) => {
    expect(errorOf(() => assertForecastOptions({ startYear: START, ...overrides }))).toBe(message);
    expect(errorOf(() => computeForecast({ startYear: START, components: [], ...overrides }))).toBe(message);
  });

  it("accepts the limits", () => {
    expect(() =>
      assertForecastOptions({ startYear: START, horizonYears: 100, reserveHorizonYears: 0, inflationRate: 1, currentReserveBalance: 0, atRiskYears: 100 }),
    ).not.toThrow();
    expect(() => assertForecastOptions({ startYear: START, adjustments: [{ year: START, amount: Number.POSITIVE_INFINITY }] })).not.toThrow();
  });

  it("checks in order: horizon, reserve horizon, start year, inflation, balance, adjustments, at-risk window", () => {
    const all = {
      startYear: 0.5,
      horizonYears: 0,
      reserveHorizonYears: -1,
      inflationRate: 2,
      currentReserveBalance: -1,
      adjustments: [{ year: -5, amount: -1 }],
      atRiskYears: -1,
    };
    const order = ["horizonYears", "reserveHorizonYears", "startYear", "inflationRate", "currentReserveBalance", "adjustments", "atRiskYears"] as const;
    const fixed = { startYear: START, horizonYears: 10, reserveHorizonYears: 30, inflationRate: 0, currentReserveBalance: 0, adjustments: [], atRiskYears: 2 };
    const seen: string[] = [];
    for (let i = 0; i < order.length; i++) {
      const options = { ...all };
      for (const key of order.slice(0, i)) Object.assign(options, { [key]: fixed[key] });
      seen.push(errorOf(() => assertForecastOptions(options)).split(" ")[0]);
    }
    expect(seen).toEqual(["Forecast", "Reserve", "Start", "Inflation", "Current", "An", "At-risk"]);
  });

  it("checks the options before any component", () => {
    expect(errorOf(() => computeForecast({ startYear: 2026.5, components: [component({ quantity: 0 })] }))).toBe("Start year must be a whole year.");
  });
});
