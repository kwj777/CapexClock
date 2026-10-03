// Side by side: the frozen copy of today's forecast math (./legacy) against the
// engine and the landlord vertical, on thousands of seeded made-up buildings and
// typed fields. Every number must be the same to the last bit (Object.is), not
// merely close, so moving the site onto the engine changes no number. The
// "current code" block below turns the new results into today's shapes.

import {
  assertForecastOptions,
  computeForecast,
  findAtRisk,
  levelMonthlyReserve,
  nextReplacementReserve,
  type AtRiskComponent,
  type Component,
  type PlannedExpense,
  type Replacement,
} from "@/engine";
import {
  assertUnitCount,
  byUrgencyThenName,
  COMPONENT_LIBRARY,
  compareReplaceAtRiskNow,
  LANDLORD_RULES,
  landlordForecast,
  landlordOptions,
  lifespanEstimate,
  mockupReservePerUnit,
  quickEstimate,
  quickSystems,
  reserveCalculator,
  reserveFromExpenses,
  withLandlordMetrics,
  type CompareOptions,
  type ExpenseFields,
  type LandlordForecast,
  type LibraryComponent,
  type ReserveCalculatorResult,
  type TypicalCost,
} from "@/verticals/landlord";
import { corpusCase, mulberry32, type CorpusComponent } from "./generate";
import * as legacy from "./legacy/forecast";
import * as legacyCompare from "./legacy/compare";
import { legacyLifespanEstimate } from "./legacy/lifespan-estimator";
import * as lq from "./legacy/quick-estimate";
import { legacyReserveCalculator } from "./legacy/reserve-calculator";
import { sinkingFund as legacySinkingFund } from "./legacy/sinking-fund";
import type { AtRiskItem, Forecast as LegacyForecast, Replacement as LegacyReplacement } from "./legacy/types";

// ---------------------------------------------------------------------------
// The current code, as the site calls it: the engine through the landlord
// vertical. Each function returns the shape the legacy code returns, so the two
// can be compared field by field.
// ---------------------------------------------------------------------------
const toEngine = (c: CorpusComponent): Component => ({
  id: c.id,
  category: c.category,
  name: c.name,
  quantity: c.quantity,
  installYear: c.installYear,
  usefulLifeYears: c.usefulLifeYears,
  replacementCostEach: c.replacementCostEach,
  ...(c.scenario ? { scenario: c.scenario } : {}),
  ...(c.installYearIsEstimate !== undefined ? { estimated: { installYear: c.installYearIsEstimate } } : {}),
});

const asLegacyReplacement = (r: Replacement): LegacyReplacement => ({
  componentId: r.componentId,
  name: r.name,
  category: r.category,
  year: r.year,
  cost: r.cost,
  overdue: r.overdue,
  installYearIsEstimate: r.estimated.installYear,
});

const asLegacyAtRisk = (a: AtRiskComponent): AtRiskItem => ({
  componentId: a.componentId,
  name: a.name,
  category: a.category,
  endOfLifeYear: a.endOfLifeYear,
  yearsRemaining: a.yearsRemaining,
  status: a.status,
  installYearIsEstimate: a.estimated.installYear,
});

function asLegacyForecast(f: LandlordForecast): LegacyForecast {
  return {
    startYear: f.startYear,
    endYear: f.endYear,
    years: f.years.map((y) => ({ year: y.year, total: y.total, byCategory: { ...y.byCategory }, replacements: y.replacements.map(asLegacyReplacement) })),
    total: f.horizonTotal,
    neededNow: f.neededNow,
    monthlyReserve: f.monthlyReserve,
    monthlyReservePerUnit: f.monthlyReservePerUnit,
    savingAhead: f.savingAhead.map(asLegacyReplacement),
    atRisk: f.atRisk.map(asLegacyAtRisk),
  };
}

const asLegacyReserve = (r: ReserveCalculatorResult) => ({
  monthly: r.monthly,
  perUnit: r.perUnit,
  shortfallNow: r.shortfallNow,
  total: r.total,
  schedule: r.schedule.map((y) => ({ year: y.yearsFromStart, deposits: y.deposits, spent: y.spent, endBalance: y.endBalance })),
});

const current = {
  forecast(components: CorpusComponent[], unitCount: number, startYear: number, years?: number): LegacyForecast {
    if (years === undefined) return asLegacyForecast(landlordForecast(components.map(toEngine), unitCount, startYear));
    // The site always shows 10 years; other windows go through the engine with the landlord's checks and order.
    const options = { ...landlordOptions(startYear), horizonYears: years };
    assertForecastOptions(options);
    assertUnitCount(unitCount);
    return asLegacyForecast(withLandlordMetrics(computeForecast({ ...options, components: components.map(toEngine) }), unitCount));
  },
  atRisk(components: CorpusComponent[], startYear: number) {
    return [...findAtRisk(components.map(toEngine), startYear, LANDLORD_RULES.atRiskYears)].sort(byUrgencyThenName).map(asLegacyAtRisk);
  },
  compare(components: CorpusComponent[], unitCount: number, startYear: number, options: CompareOptions) {
    const c = compareReplaceAtRiskNow({ startYear, unitCount, components: components.map(toEngine) }, options);
    return { ...c, items: c.items.map(asLegacyAtRisk) };
  },
  compareItems(components: CorpusComponent[], unitCount: number, startYear: number, options: CompareOptions) {
    return compareReplaceAtRiskNow({ startYear, unitCount, components: components.map(toEngine) }, options).items;
  },
  sinkingFund(expenses: PlannedExpense[], currentBalance: number, units: number) {
    return asLegacyReserve(reserveFromExpenses(expenses, currentBalance, units));
  },
  reserveCalculator(rows: ExpenseFields[], balance: string, units: string) {
    const { inputs, result } = reserveCalculator(rows, balance, units);
    return { inputs, result: result && asLegacyReserve(result) };
  },
  nextReplacementReserve(c: CorpusComponent, startYear: number) {
    return nextReplacementReserve(toEngine(c), startYear);
  },
  lifespan(item: LibraryComponent, installYear: string, quantity: string, costEach: string, currentYear: number) {
    const { badYear, result: r, moneyHint } = lifespanEstimate({ item, installYear, quantity, costEach, currentYear });
    return {
      result: r && { due: r.due, low: r.low, high: r.high, monthly: r.monthly, neededNow: r.neededNow, savingFor: r.savingFor },
      moneyHint,
      yearsLeft: r ? r.yearsLeft : 0,
      forecastCountsFrom: r ? r.forecastCountsFrom : null,
      badYear,
    };
  },
  levelMonthlyReserve(totals: number[]): number {
    return levelMonthlyReserve(totals).monthly;
  },
  mockupReservePerUnit,
  quickSystems,
  quickEstimate,
};
// ---------------------------------------------------------------------------

const legacyForecast = (components: CorpusComponent[], unitCount: number, startYear: number, years?: number) =>
  legacy.computeForecast({ startYear, years, unitCount, components });

/** Exact comparison: every number must be the same bits (Object.is), not merely close. */
function exact(a: unknown, b: unknown, path = "$"): void {
  if (typeof a === "number" && typeof b === "number") {
    if (!Object.is(a, b)) throw new Error(`${path}: ${a} !== ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`${path}: length ${a.length} !== ${b.length}`);
    a.forEach((x, i) => exact(x, b[i], `${path}[${i}]`));
    return;
  }
  if (a instanceof Map && b instanceof Map) {
    exact([...a], [...b], path);
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    exact(ka, kb, `${path}.keys`);
    for (const k of ka) exact((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    return;
  }
  if (a !== b) throw new Error(`${path}: ${String(a)} !== ${String(b)}`);
}

const errorOf = (f: () => unknown): string => {
  try {
    f();
    return "";
  } catch (e) {
    return (e as Error).message;
  }
};

// Figures of a forecast both sides have, field by field.
function view(f: LegacyForecast) {
  return {
    startYear: f.startYear,
    endYear: f.endYear,
    years: f.years.map((y) => [y.year, y.total, Object.entries(y.byCategory), y.replacements]),
    total: f.total,
    neededNow: f.neededNow,
    monthly: f.monthlyReserve,
    perUnit: f.monthlyReservePerUnit,
    savingAhead: f.savingAhead,
    atRisk: f.atRisk,
  };
}

describe("side by side: forecasts", () => {
  it("3,000 made-up buildings, the 10-year window", () => {
    const rand = mulberry32(20261002);
    for (let i = 0; i < 3000; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      exact(view(current.forecast(components, unitCount, startYear)), view(legacyForecast(components, unitCount, startYear)), `case ${i}`);
    }
  });

  it("1,500 made-up buildings, windows of 1 to 45 years", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1500; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      const years = 1 + Math.floor(rand() * 45);
      exact(
        view(current.forecast(components, unitCount, startYear, years)),
        view(legacyForecast(components, unitCount, startYear, years)),
        `case ${i} (years ${years})`,
      );
    }
  });

  it("the same first error for a component it can't use", () => {
    const rand = mulberry32(99);
    let checked = 0;
    for (let i = 0; i < 500; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      if (components.length === 0) continue;
      const k = Math.floor(rand() * components.length);
      const bad = [...components];
      bad[k] = { ...bad[k], quantity: [0, -1, Number.NaN][i % 3], usefulLifeYears: [0, 101, 2.5, 10][i % 4] };
      const a = errorOf(() => legacyForecast(bad, unitCount, startYear));
      expect(errorOf(() => current.forecast(bad, unitCount, startYear))).toBe(a);
      expect(a).not.toBe("");
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("checks the window, then the start year, then the unit count", () => {
    for (const [unitCount, startYear, years] of [
      [-1, 2026.5, 0],
      [-1, 2026.5, 10],
      [-1, 2026, 10],
      [Number.NaN, 2026, 10],
      [Number.POSITIVE_INFINITY, 2026, 10],
      [12, 2026, 2.5],
    ]) {
      const a = errorOf(() => legacyForecast([], unitCount, startYear, years));
      expect(a).not.toBe("");
      expect(errorOf(() => current.forecast([], unitCount, startYear, years))).toBe(a);
    }
  });

  it("1,000 at-risk lists, names that tie but for case or accents", () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const { startYear, components } = corpusCase(rand);
      exact(current.atRisk(components, startYear), legacy.atRiskItems(components, startYear), `case ${i}`);
    }
  });

  // A visitor whose browser isn't in English: the at-risk order follows their
  // language's alphabet, today and after the move.
  for (const locale of ["cs", "lt", "sv", "tr"]) {
    it(`the at-risk order and the comparison in a ${locale} browser`, () => {
      const original = String.prototype.localeCompare;
      const names = ["Heat pump", "Chimney liner", "Dryer", "Drinking fountain", "Ice maker", "Iron gate", "Zinc", "Ärea", "Örn", "Øven", "Window"];
      String.prototype.localeCompare = function (this: string, that: string, locales?: string | string[], options?: Intl.CollatorOptions) {
        return original.call(this, that, locales ?? locale, options);
      };
      try {
        const rand = mulberry32(31);
        let unlikeEnglish = 0;
        for (let i = 0; i < 1000; i++) {
          const { startYear, unitCount, components: raw } = corpusCase(rand);
          const components = raw.map((c) => ({ ...c, name: names[Math.floor(rand() * names.length)] }));
          const o = legacyForecast(components, unitCount, startYear);
          exact(current.forecast(components, unitCount, startYear).atRisk, o.atRisk, `case ${i}`);
          const a = legacyCompare.compareReplaceNow({ startYear, unitCount, components }, { emergencyPercent: 25 });
          const b = current.compare(components, unitCount, startYear, { emergencyPercent: 25 });
          exact([b.items, b.chosen, b.asPlanned, b.replaceNow], [a.items, a.chosen, a.asPlanned, a.replaceNow], `compare case ${i}`);
          const english = [...o.atRisk].sort((x, y) => x.yearsRemaining - y.yearsRemaining || original.call(x.name, y.name, "en"));
          if (english.map((x) => x.componentId).join() !== o.atRisk.map((x) => x.componentId).join()) unlikeEnglish++;
        }
        // Czech and Lithuanian sort some of these names differently from English.
        if (locale === "cs" || locale === "lt") expect(unlikeEnglish).toBeGreaterThan(0);
      } finally {
        String.prototype.localeCompare = original;
      }
    });
  }

  it("amounts that overflow to Infinity: the same figures, no error", () => {
    const big: CorpusComponent = { id: "big", category: "Roofing", name: "Big roof", quantity: 1e200, installYear: 2000, usefulLifeYears: 30, replacementCostEach: 1e200 };
    const small: CorpusComponent = { id: "s", category: "HVAC", name: "Boiler", quantity: 1, installYear: 2010, usefulLifeYears: 15, replacementCostEach: 9000 };
    const cases: CorpusComponent[][] = [
      [big],
      [big, small],
      [{ ...big, installYear: 1990 }, small],
      [{ ...big, quantity: 1e308, replacementCostEach: 10 }, { ...big, id: "b2", quantity: 1e308, replacementCostEach: 10 }],
    ];
    const rand = mulberry32(41);
    for (let i = 0; i < 500; i++) {
      const { components } = corpusCase(rand);
      cases.push(components.map((c) => (rand() < 0.3 ? { ...c, quantity: 1e154 * (1 + rand()), replacementCostEach: 1e154 * (1 + rand()) } : c)));
    }
    cases.forEach((components, i) => {
      for (const unitCount of [0, 12]) {
        exact(view(current.forecast(components, unitCount, 2026)), view(legacyForecast(components, unitCount, 2026)), `overflow case ${i}`);
        for (const emergencyPercent of [0, 25]) {
          const a = legacyCompare.compareReplaceNow({ startYear: 2026, unitCount, components }, { emergencyPercent });
          const b = current.compare(components, unitCount, 2026, { emergencyPercent });
          exact([b.items, b.chosen, b.asPlanned, b.replaceNow], [a.items, a.chosen, a.asPlanned, a.replaceNow], `overflow compare ${i}`);
        }
      }
    });
    expect(current.forecast([big], 12, 2026).monthlyReserve).toBe(Infinity);
    const rows = [
      { cost: 1e308, yearsUntilDue: 5 },
      { cost: 1e308, yearsUntilDue: 5 },
    ];
    exact(current.sinkingFund(rows, 0, 12), legacySinkingFund({ expenses: rows, currentBalance: 0, units: 12 }));
    expect(current.sinkingFund(rows, 0, 12).monthly).toBe(Infinity);
  });
});

describe("side by side: reserves", () => {
  it("the level monthly reserve on 3,000 lists of year totals, and the home page figure", () => {
    const rand = mulberry32(11);
    for (let i = 0; i < 3000; i++) {
      const totals = Array.from({ length: Math.floor(rand() * 40) }, () =>
        rand() < 0.4 ? 0 : rand() < 0.5 ? Math.floor(rand() * 1e5) : rand() * 1e5,
      );
      const years = totals.map((total, year) => ({ year, total, byCategory: {}, replacements: [] }));
      exact(current.levelMonthlyReserve(totals), legacy.levelMonthlyReserve(years), `case ${i}`);
    }
    const spend = [6, 15, 7, 42, 13, 6, 26, 2, 15, 23];
    exact(
      current.mockupReservePerUnit(),
      legacy.levelMonthlyReserve(spend.map((t, year) => ({ year, total: t * 1000, byCategory: {}, replacements: [] }))) / 12,
    );
  });

  it("the reserve calculator's figures on 3,000 lists of expenses", () => {
    const rand = mulberry32(5);
    for (let i = 0; i < 3000; i++) {
      const expenses = Array.from({ length: Math.floor(rand() * 8) }, () => ({
        cost: [0, -5, Number.NaN, 12000, 0.1, Math.floor(rand() * 2e5), rand() * 1e5][Math.floor(rand() * 7)],
        yearsUntilDue: [0, 1, 2, 5, 30, 99, 100, 2.5, Number.NaN, -1, Math.floor(rand() * 101)][Math.floor(rand() * 11)],
      }));
      const balance = [0, 0, 4000, 6000, rand() * 1e5, Math.floor(rand() * 1e5)][Math.floor(rand() * 6)];
      const units = [0, 1, 2.5, 10, 12][Math.floor(rand() * 5)];
      exact(current.sinkingFund(expenses, balance, units), legacySinkingFund({ expenses, currentBalance: balance, units }), `case ${i}`);
    }
    const tooFar = [{ cost: 0, yearsUntilDue: 101 }];
    expect(errorOf(() => current.sinkingFund(tooFar, 0, 1))).toBe("Years until due can't be more than 100.");
  });

  it("a single component's reserve (lifespan pages)", () => {
    const rand = mulberry32(13);
    for (let i = 0; i < 3000; i++) {
      const { startYear, components } = corpusCase(rand);
      for (const c of components) {
        exact(current.nextReplacementReserve(c, startYear), legacy.nextReplacementReserve(c, startYear), `case ${i} ${c.id}`);
      }
    }
  });
});

describe("side by side: the comparison and the quick estimate", () => {
  it("1,500 replace-now comparisons", () => {
    const rand = mulberry32(17);
    for (let i = 0; i < 1500; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      const only = rand() < 0.5 ? new Set(components.filter(() => rand() < 0.5).map((c) => c.id)) : undefined;
      const emergencyPercent = [undefined, 0, 25, 37.5, 500, -5, rand() * 100][Math.floor(rand() * 7)];
      const a = legacyCompare.compareReplaceNow({ startYear, unitCount, components }, { only, emergencyPercent });
      const b = current.compare(components, unitCount, startYear, { only, emergencyPercent });
      exact([b.items, b.alreadyReplacing, b.chosen, b.asPlanned, b.replaceNow], [a.items, a.alreadyReplacing, a.chosen, a.asPlanned, a.replaceNow], `case ${i}`);
    }
  });

  it("quick estimates for every year built from 1800 to 2026", () => {
    const rand = mulberry32(19);
    const costs: TypicalCost[] = COMPONENT_LIBRARY.map((item, i) => ({
      slug: item.slug,
      low: [2600, 3, 0.15, 900][i % 4],
      high: [4700, 6, 0.3, 2000][i % 4],
      per: item.unitLabel === "per_sq_ft" ? "sq_ft" : "apartment",
    }));
    const oldSystems = lq.quickSystems(COMPONENT_LIBRARY, costs);
    const newSystems = current.quickSystems(COMPONENT_LIBRARY, costs);
    exact(newSystems, oldSystems);
    for (let yearBuilt = 1800; yearBuilt <= 2026; yearBuilt++) {
      const ticked = new Set(oldSystems.filter(() => rand() < 0.6).map((s) => s.item.slug));
      const units = [1, 12, 2.5, 100000, Math.floor(rand() * 500)][Math.floor(rand() * 5)];
      const spread = rand() < 0.7;
      exact(
        current.quickEstimate(newSystems, ticked, units, yearBuilt, 2026, spread),
        lq.quickEstimate(oldSystems, ticked, units, yearBuilt, 2026, spread),
        `year built ${yearBuilt}`,
      );
    }
  });
});

describe("side by side: what pages worked out from their fields", () => {
  it("each compared item's cost and whether it's paid in the first year either way, on 1,500 comparisons", () => {
    const rand = mulberry32(23);
    for (let i = 0; i < 1500; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      const byId = new Map(components.map((c) => [c.id, c]));
      const items = current.compareItems(components, unitCount, startYear, {});
      // Today the panel works these out itself: quantity × cost each, and end of life ≤ this year.
      const today = legacyCompare.compareReplaceNow({ startYear, unitCount, components }).items.map((item) => {
        const c = byId.get(item.componentId)!;
        return [item.componentId, legacy.replacementCost(c), legacy.endOfLifeYear(c) <= startYear];
      });
      exact(items.map((x) => [x.componentId, x.cost, x.paidInFirstYearEitherWay]), today, `case ${i}`);
    }
  });

  it("the comparison refuses what today's refuses, with the same first error", () => {
    const rand = mulberry32(29);
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const { startYear, unitCount, components } = corpusCase(rand);
      if (components.length === 0) continue;
      const bad = [...components];
      const k = Math.floor(rand() * bad.length);
      bad[k] = { ...bad[k], quantity: [0, -1, Number.NaN][i % 3] };
      for (const [units, year] of [[unitCount, startYear], [-1, startYear], [-1, startYear + 0.5]]) {
        const a = errorOf(() => legacyCompare.compareReplaceNow({ startYear: year, unitCount: units, components: bad }));
        expect(a).not.toBe("");
        expect(errorOf(() => current.compare(bad, units, year, {}))).toBe(a);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("the reserve calculator on 3,000 sets of typed fields: what it reads and when it shows figures", () => {
    const rand = mulberry32(37);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
    const costs = ["", "", "12000", "$60,000", "1.4k", "-5", "0", "0.1", "1e308", "abc", " 2 500 ", String(Math.floor(rand() * 2e5))];
    const years = ["", "", "0", "1", "5", "2.5", "30", "100", "101", "2031", "1900", "-1", "abc", "1e400"];
    for (let i = 0; i < 3000; i++) {
      const rows: ExpenseFields[] = Array.from({ length: Math.floor(rand() * 5) }, (_, id) => ({
        id,
        cost: pick(costs),
        years: pick([...years, String(Math.floor(rand() * 101))]),
      }));
      const balance = pick(["", "", "30,000", "$30k", "-5000", "4000", "abc", String(rand() * 1e5)]);
      const units = pick(["", "12", "12.5", "0", "abc", "1,000"]);
      exact(current.reserveCalculator(rows, balance, units), legacyReserveCalculator(rows, balance, units), `case ${i}`);
    }
  });

  it("lifespan pages on 5,000 sets of typed fields", () => {
    const rand = mulberry32(43);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
    const years = ["", "  ", "98", "1899", "1900", "2014", "2014.5", "abc", "1e400", "2,014"];
    const quantities = ["", "0", "1", "12", "1,200", "lots", "-3", "2.5", "1e200"];
    const costs = ["", "0", "1400", "$1,400", "1.4k", "-5", "0.25", "1e200", "38000"];
    for (let i = 0; i < 5000; i++) {
      const item = pick(COMPONENT_LIBRARY);
      const currentYear = 2020 + Math.floor(rand() * 16);
      const installYear = rand() < 0.5 ? String(1890 + Math.floor(rand() * 150)) : pick([...years, String(currentYear), String(currentYear + 1)]);
      const quantity = pick([...quantities, String(rand() * 1000)]);
      const cost = pick([...costs, String(Math.round(rand() * 1e6) / 100)]);
      exact(
        current.lifespan(item, installYear, quantity, cost, currentYear),
        legacyLifespanEstimate(item, installYear, quantity, cost, currentYear),
        `case ${i}`,
      );
    }
  });
});
