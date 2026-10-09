import type { Component } from "@/engine";
import { exampleDraft } from "../draft/example";
import { EMPTY_DRAFT, type Draft, type DraftRow } from "../draft/model";
import { forecastDraft, landlordForecast, withLandlordMetrics } from "../forecast";
import { byUrgencyThenName, LANDLORD_RULES, landlordOptions } from "../rules";

const START = 2026;

function component(overrides: Partial<Component> = {}): Component {
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

// The 3-component test building: water heaters overdue, a roof in 2030 and condensers in 2033.
const building: Component[] = [
  component({ id: "roof", category: "Roofing", name: "Roof", quantity: 1, installYear: 2008, usefulLifeYears: 22, replacementCostEach: 36000 }),
  component({ id: "wh", category: "Plumbing", name: "Water heaters", quantity: 24, installYear: 2014, usefulLifeYears: 10, replacementCostEach: 1400 }),
  component({ id: "hvac", category: "HVAC", name: "Condensers", quantity: 12, installYear: 2019, usefulLifeYears: 14, replacementCostEach: 4500 }),
];

const errorOf = (f: () => unknown): string => {
  try {
    f();
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

describe("the rules every landlord forecast uses", () => {
  it("are Kevin's: 10 years shown, 30 ahead, at risk within 2, today's dollars, $0 saved", () => {
    expect(LANDLORD_RULES).toEqual({
      horizonYears: 10,
      reserveHorizonYears: 30,
      atRiskYears: 2,
      inflationRate: 0,
      currentReserveBalance: 0,
      contingencyRate: 0,
    });
    expect(landlordOptions(START)).toEqual({ startYear: START, ...LANDLORD_RULES });
  });

  it("are passed to the engine, never left to its defaults", () => {
    const f = landlordForecast(building, 24, START);
    expect(f.startYear).toBe(2026);
    expect(f.endYear).toBe(2035);
    expect(f.horizonYears).toBe(10);
    expect(f.reserveFromYear).toBe(2027);
    expect(f.reserveThroughYear).toBe(2056);
    expect(f.currentReserveBalance).toBe(0);
    expect(f.shortfallNow).toBe(f.neededNow);
    expect(f.replacements.every((r) => r.cost === r.baseCost)).toBe(true);
  });
});

describe("a landlord forecast", () => {
  const f = landlordForecast(building, 24, START);

  it("has the engine's figures and the per-unit one", () => {
    expect(f.neededNow).toBe(33600);
    expect(f.horizonTotal).toBe(33600 + 36000 + 54000);
    expect(f.monthlyReserve).toBe(90000 / 84);
    expect(f.monthlyReservePerUnit).toBe(90000 / 84 / 24);
    expect(f.unitCount).toBe(24);
    expect(f.tightestYear).toBe(2033);
  });

  it("returns zeros for no components", () => {
    const empty = landlordForecast([], 10, START);
    expect([empty.horizonTotal, empty.neededNow, empty.monthlyReserve, empty.monthlyReservePerUnit]).toEqual([0, 0, 0, 0]);
    expect(empty.atRisk).toEqual([]);
  });

  it("checks the start year, then the unit count, then the components", () => {
    const bad = component({ quantity: 0 });
    expect(errorOf(() => landlordForecast([bad], -1, 2026.5))).toBe("Start year must be a whole year.");
    expect(errorOf(() => landlordForecast([bad], -1, START))).toBe("Unit count can't be negative.");
    for (const unitCount of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(errorOf(() => landlordForecast([], unitCount, START))).toBe("Unit count can't be negative.");
    }
    expect(errorOf(() => landlordForecast([bad], 12, START))).toBe(
      'Invalid component "Tank water heater": Quantity must be greater than zero.',
    );
  });
});

describe("the at-risk list's order", () => {
  // Due in 2027 and 2028, past due, and three tied on years left.
  const atRisk = [
    component({ id: "a", name: "Zinc", installYear: 2017 }),
    component({ id: "b", name: "Boiler", installYear: 2010 }),
    component({ id: "c", name: "roof", installYear: 2018 }),
    component({ id: "d", name: "Roof", installYear: 2018 }),
    component({ id: "e", name: "Carpet", installYear: 2018 }),
    component({ id: "f", name: "Roof", installYear: 2018 }),
  ];

  it("is most urgent first, then by name, and keeps the order given for the same name", () => {
    const ids = landlordForecast(atRisk, 12, START).atRisk.map((a) => a.componentId);
    const today = [...landlordForecast(atRisk, 12, START).atRisk].sort(
      (x, y) => x.yearsRemaining - y.yearsRemaining || x.name.localeCompare(y.name),
    );
    expect(ids).toEqual(today.map((a) => a.componentId));
    expect(ids.slice(0, 2)).toEqual(["b", "a"]);
    expect(ids.indexOf("d")).toBeLessThan(ids.indexOf("f"));
  });

  // A visitor whose browser isn't in English sees names in their own alphabet's order, as today.
  for (const locale of ["cs", "lt"]) {
    it(`follows the visitor's alphabet in a ${locale} browser`, () => {
      const original = String.prototype.localeCompare;
      String.prototype.localeCompare = function (this: string, that: string, locales?: string | string[], options?: Intl.CollatorOptions) {
        return original.call(this, that, locales ?? locale, options);
      };
      try {
        // In Czech and Lithuanian, "Ch" and "Y"-like letters sort differently from English.
        const names = ["Heat pump", "Chimney liner", "Ice maker", "Yard light", "Iron gate", "Dryer"];
        const tied = names.map((name, i) => component({ id: `t${i}`, name, installYear: 2017 }));
        const shown = landlordForecast(tied, 12, START).atRisk.map((a) => a.name);
        expect(shown).toEqual([...names].sort((x, y) => x.localeCompare(y)));
        expect(shown).not.toEqual([...names].sort((x, y) => original.call(x, y, "en")));
      } finally {
        String.prototype.localeCompare = original;
      }
    });
  }

  it("is today's comparator: years left, then name", () => {
    expect(byUrgencyThenName({ yearsRemaining: -1, name: "Z" }, { yearsRemaining: 0, name: "A" })).toBeLessThan(0);
    expect(byUrgencyThenName({ yearsRemaining: 1, name: "B" }, { yearsRemaining: 1, name: "A" })).toBeGreaterThan(0);
    expect(byUrgencyThenName({ yearsRemaining: 1, name: "A" }, { yearsRemaining: 1, name: "A" })).toBe(0);
  });

  it("is added without changing the engine's result", () => {
    const f = landlordForecast(atRisk, 12, START);
    const engineOrder = [...f.atRisk].sort((x, y) => x.yearsRemaining - y.yearsRemaining);
    const before = engineOrder.map((a) => a.componentId);
    withLandlordMetrics({ ...f, atRisk: engineOrder }, 12);
    expect(engineOrder.map((a) => a.componentId)).toEqual(before);
  });
});

describe("forecasting the calculator's form", () => {
  const row = (over: Partial<DraftRow>): DraftRow => ({
    id: "r1",
    librarySlug: null,
    category: "Plumbing",
    name: "Water heater",
    quantity: "12",
    unitLabel: "per_unit",
    installYear: "2016",
    usefulLife: "10",
    costEach: "1400",
    scenario: "run_to_failure",
    followsUnitCount: true,
    ...over,
  });

  it("forecasts the example building", () => {
    const draft = exampleDraft();
    const d = forecastDraft(draft, START);
    expect(d.problems).toEqual({});
    expect(d.unitCount).toBe(12);
    expect(d.yearBuiltIsBad).toBe(false);
    expect(d.components.map((c) => c.id)).toEqual(draft.rows.map((r) => r.id));
    expect(d.forecast).toEqual(landlordForecast(d.components, 12, START));
    expect(Math.ceil(d.forecast.monthlyReserve)).toBe(2684);
    expect(Math.ceil(d.forecast.monthlyReservePerUnit ?? 0)).toBe(224);
    expect(d.forecast.neededNow).toBe(30000);
    expect(d.forecast.horizonTotal).toBe(162800);
  });

  it("marks a blank install year (year built stands in) or a guessed one as an estimate", () => {
    const draft: Draft = {
      unitCount: "12",
      yearBuilt: "1998",
      rows: [row({ id: "blank", installYear: "" }), row({ id: "guess", installYearIsGuess: true }), row({ id: "known" })],
    };
    const { components } = forecastDraft(draft, START);
    expect(components.map((c) => [c.id, c.installYear, c.estimated?.installYear])).toEqual([
      ["blank", 1998, true],
      ["guess", 2016, true],
      ["known", 2016, false],
    ]);
  });

  it("leaves out rows with a problem and reports them, never guessing", () => {
    const draft: Draft = {
      unitCount: "2.5",
      yearBuilt: "98",
      rows: [row({ id: "ok" }), row({ id: "noName", name: " " }), row({ id: "blank", installYear: "" }), row({ id: "noCost", costEach: "" })],
    };
    const d = forecastDraft(draft, START);
    expect(d.components.map((c) => c.id)).toEqual(["ok"]);
    expect(d.problems).toEqual({ noName: "missing_name", blank: "bad_year_built", noCost: "missing_cost" });
    expect(d.yearBuiltIsBad).toBe(true);
    expect(d.unitCount).toBe(2.5);
    expect(d.forecast.unitCount).toBe(2.5);
  });

  it("forecasts an empty form as nothing to save for", () => {
    const d = forecastDraft(EMPTY_DRAFT, START);
    expect(d.components).toEqual([]);
    expect(d.unitCount).toBe(0);
    expect(d.forecast.monthlyReserve).toBe(0);
    expect(d.forecast.monthlyReservePerUnit).toBeNull();
  });

  it("shows amounts too big to hold as Infinity rather than failing", () => {
    const draft: Draft = { unitCount: "12", yearBuilt: "", rows: [row({ quantity: "1e200", costEach: "1e200", installYear: "2000", usefulLife: "30" })] };
    const d = forecastDraft(draft, START);
    expect(d.problems).toEqual({});
    expect(d.forecast.monthlyReserve).toBe(Infinity);
  });
});

describe("the safety buffer", () => {
  it("adds 10% or 20% to the monthly reserve and per-unit figure, and nothing else", () => {
    const plain = landlordForecast(building, 24, START);
    for (const buffer of [10, 20] as const) {
      const padded = landlordForecast(building, 24, START, buffer);
      expect(padded.contingencyRate).toBe(buffer / 100);
      expect(padded.monthlyReserveBeforeContingency).toBe(plain.monthlyReserve);
      expect(padded.monthlyReserve).toBeCloseTo(plain.monthlyReserve * (1 + buffer / 100), 9);
      expect(padded.monthlyReservePerUnit).toBeCloseTo(padded.monthlyReserve / 24, 9);
      expect(padded.neededNow).toBe(plain.neededNow);
      expect(padded.years).toEqual(plain.years);
    }
    expect(landlordOptions(START, 20)).toEqual({ startYear: START, ...LANDLORD_RULES, contingencyRate: 0.2 });
  });

  it("comes from the calculator's draft, and a damaged one counts as none", () => {
    const draft = exampleDraft();
    const plain = forecastDraft(draft, START).forecast;
    expect(forecastDraft({ ...draft, safetyBuffer: 20 }, START).forecast.monthlyReserve).toBeCloseTo(plain.monthlyReserve * 1.2, 9);
    expect(forecastDraft({ ...draft, safetyBuffer: 15 as never }, START).forecast.monthlyReserve).toBe(plain.monthlyReserve);
  });
});
