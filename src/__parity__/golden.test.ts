// Today's numbers, saved. Every figure the site works out (the calculator, saved
// properties, the portfolio, the reserve calculator, lifespan pages, the home
// page, the comparison, the quick estimate and the condition report) for fixed
// inputs and a seeded corpus of made-up buildings. The saved file
// (__snapshots__/golden.test.ts.snap) must not change when the code is only
// reorganized: the "Today's numbers unchanged" check fails if it does.

import { forecastSummary } from "@/components/calculator/announce";
import { toChartRows } from "@/components/calculator/chartData";
import { formatMoney, formatReserve } from "@/components/calculator/format";
import { mockupReservePerUnit } from "@/components/ForecastMockup";
import { estimateText } from "@/components/reserve/estimate-text";
import { forecastCsv } from "@/lib/export/csv";
import { exportDetails, exportRows, sumTotals } from "@/lib/export/rows";
import { compareReplaceNow, computeForecast, type ForecastComponent } from "@/lib/forecast";
import { forecastForProperty } from "@/lib/properties/convert";
import { summarizePortfolio } from "@/lib/properties/portfolio";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import {
  ageText,
  COMPONENT_LIBRARY,
  defaultLife,
  exampleDraft,
  lifeDrivers,
  lifespanDescription,
  lifespanTitle,
  parseUnitCount,
  quickEstimate,
  quickSystems,
  remainingLifeText,
  roundEstimate,
  sampleReport,
  statusText,
  TICKED_BY_DEFAULT,
  toComponents,
  TYPICAL_COSTS,
  UNIT_LABEL_TEXT,
  type Draft,
  type ExpenseFields,
} from "@/verticals/landlord";
import { corpus, CORPUS_SEED, type CorpusComponent } from "./generate";
import { legacyLifespanEstimate } from "./legacy/lifespan-estimator";
import { legacyReserveCalculator } from "./legacy/reserve-calculator";
import { compactLine, forecastLines, n, type KeyOf } from "./view";

// The forecast code as the site calls it. Only these adapters change when the code moves.
const toComponent = (c: CorpusComponent): ForecastComponent => ({ ...c });
const forecastOf = (components: ForecastComponent[], unitCount: number, startYear: number) =>
  computeForecast({ startYear, unitCount, components });
const lifespanEstimate = legacyLifespanEstimate;
const reserveCalculator = legacyReserveCalculator;

/** Row ids in the example change with the clock, so they're shown by library slug. */
function keysOf(draft: Draft): KeyOf {
  const slugs = new Map(draft.rows.map((r, i) => [r.id, r.librarySlug ?? `row${i}`]));
  return (id) => slugs.get(id) ?? id;
}

describe("the calculator's example building", () => {
  for (const year of [2026, 2027, 2040]) {
    it(`in ${year}`, () => {
      const draft = exampleDraft();
      const key = keysOf(draft);
      const { components, problems } = toComponents(draft, year);
      const unitCount = parseUnitCount(draft.unitCount);
      const f = forecastOf(components, unitCount, year);
      const chart = toChartRows(f);
      const details = exportDetails(draft.rows, components);
      const rows = exportRows(f, components, details.unitLabels, details.rowDetails);
      const pdfYears = f.years.map((y) => `${y.year} ${n(sumTotals(rows.filter((r) => r.year === y.year)))}`);
      expect({
        problems: Object.keys(problems).map(key),
        forecast: forecastLines(f, key),
        shown: [
          `monthly ${formatReserve(f.monthlyReserve)}`,
          `per unit ${f.monthlyReservePerUnit === null ? "–" : formatReserve(f.monthlyReservePerUnit)}`,
          `needed now ${formatMoney(f.neededNow)}`,
          `10-year total ${formatMoney(f.total)}`,
          `announced: ${forecastSummary(f, 0)}`,
        ],
        chart: [
          chart.present.join(", "),
          ...chart.rows.map((r) =>
            [
              `${r.year} total ${n(r.total)}`,
              ...chart.present.map((c) => `${c}:${n(r[c])}`),
              // The chart's tooltip adds up the categories that have a cost, in chart order.
              `tooltip ${n(chart.present.filter((c) => (r[c] ?? 0) > 0).reduce((sum, c) => sum + (r[c] ?? 0), 0))}`,
            ].join(" "),
          ),
        ],
        exportRows: rows.map((r) => `${r.year} ${r.name} ${n(r.quantity)} ${r.unit} ${n(r.costEach)} = ${n(r.total)} ${r.notes.join("; ")}`),
        pdf: [...pdfYears, `10-year total ${n(sumTotals(rows))}`],
        csv: forecastCsv(f, components, details).split("\n"),
      }).toMatchSnapshot();
    });
  }
});

describe("lifespan pages", () => {
  const yearsFor = (life: number) => ["1900", String(2026 - life - 5), String(2026 - life), String(2026 - life + 1), "2023", "2026", "", "1899", "20x"];
  const amounts = [
    ["1", "1400"],
    ["12", "1100"],
    ["9600", "4"],
    ["", "1400"],
    ["12", "1.4k"],
    ["0", "1100"],
    ["12", ""],
  ];
  for (const item of COMPONENT_LIBRARY) {
    it(item.slug, () => {
      const life = defaultLife(item);
      const lines = [
        `life ${life} (${item.lifeLow}-${item.lifeHigh}) ${UNIT_LABEL_TEXT[item.unitLabel]}`,
        `title ${lifespanTitle(item)}`,
        `description ${lifespanDescription(item, false)}`,
        `description with notes ${lifespanDescription(item, true)}`,
        `drivers ${JSON.stringify(lifeDrivers(item))}`,
      ];
      for (const installYear of yearsFor(life)) {
        for (const [quantity, cost] of amounts) {
          const e = lifespanEstimate(item, installYear, quantity, cost, 2026);
          const r = e.result;
          lines.push(
            `[${installYear}|${quantity}|${cost}] ` +
              (r
                ? `due ${r.due} range ${r.low}-${r.high} left ${e.yearsLeft} monthly ${n(r.monthly)} now ${n(r.neededNow)} for ${n(r.savingFor)} counts ${n(e.forecastCountsFrom)}`
                : `no result${e.badYear ? " (bad year)" : ""}`) +
              (e.moneyHint ? ` hint ${e.moneyHint.field}${e.moneyHint.invalid ? "!" : ""} ${e.moneyHint.text}` : ""),
          );
        }
      }
      expect(lines).toMatchSnapshot();
    });
  }
});

describe("the reserve calculator", () => {
  const row = (cost: string, years: string, id = 1): ExpenseFields => ({ id, cost, years });
  const cases: [string, ExpenseFields[], string, string][] = [
    ["one expense", [row("12000", "5")], "", "4"],
    ["early and late", [row("60000", "2"), row("60000", "10", 2)], "", "10"],
    ["balance counts", [row("12000", "5")], "6000", "1"],
    ["balance covers it", [row("5000", "3")], "8000", "1"],
    ["due now with a balance", [row("10000", "0"), row("12000", "1", 2)], "4000", "2"],
    ["far apart", [row("24000", "2"), row("100000", "100", 2)], "", "1"],
    ["formatted", [row("$60,000", "5"), row("", "", 2)], "30,000", "12"],
    ["blank balance and units", [row("1000", "2")], "", ""],
    ["bad balance", [row("60000", "5")], "$30k", ""],
    ["bad units", [row("60000", "5")], "", "2.5"],
    ["a year typed", [row("60000", "2031")], "", ""],
    ["101 years", [row("60000", "101")], "", ""],
    ["unreadable cost, blank years, fraction", [row("1.4k", "5", 1), row("500", "", 2), row("500", "2.5", 3)], "", ""],
    ["half done", [row("60000", "")], "", ""],
    ["nothing typed", [row("", ""), row("", "", 2)], "", ""],
    ["zero cost", [row("0", "4")], "", "3"],
    ["many rows", [row("12000", "1"), row("8000", "1", 2), row("40000", "7", 3), row("250", "0", 4), row("90000.55", "30", 5)], "1500.5", "7"],
    ["balance beyond everything", [row("9000", "3"), row("1000", "0", 2)], "500000", "4"],
    ["overflow", [row("1e308", "5"), row("1e308", "5", 2)], "", "12"],
  ];
  for (const [name, rows, balance, units] of cases) {
    it(name, () => {
      const { inputs, result } = reserveCalculator(rows, balance, units);
      const lines = [
        `expenses ${inputs.expenses.map((e) => `${n(e.cost)}@${n(e.yearsUntilDue)}`).join(", ")}`,
        `problems ${[...inputs.rowProblems].map(([id, p]) => `${id}:${p.fields.join("+")} ${p.message}`).join(" / ")}`,
        `balance ${n(inputs.balance)} ${inputs.balanceProblem ?? ""} units ${n(inputs.units)} ${inputs.unitsProblem ?? ""}`,
      ];
      if (result) {
        lines.push(
          `monthly ${n(result.monthly)} (${formatReserve(result.monthly)}) perUnit ${n(result.perUnit)} shortfall ${n(result.shortfallNow)} total ${n(result.total)}`,
          ...result.schedule.map((y) => `${y.year}: +${n(y.deposits)} -${n(y.spent)} = ${n(y.endBalance)}`),
        );
      } else {
        lines.push("no result");
      }
      expect(lines).toMatchSnapshot();
    });
  }
});

describe("saved properties and the portfolio", () => {
  const property = (id: string, name: string, unitCount: number, yearBuilt: number | null = 2000): PropertyRow => ({
    id,
    user_id: "11111111-1111-1111-1111-111111111111",
    name,
    city: null,
    state: null,
    unit_count: unitCount,
    year_built: yearBuilt,
    created_at: "",
    updated_at: "",
  });
  const component = (id: string, propertyId: string, overrides: Partial<ComponentRow> = {}): ComponentRow => ({
    id,
    property_id: propertyId,
    library_slug: null,
    category: "Roofing",
    name: "Roof",
    quantity: 1,
    unit_label: "per_building",
    install_year: 2016,
    useful_life_years: 20,
    replacement_cost_each: 120_000,
    condition: null,
    notes: null,
    scenario: "run_to_failure",
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  });
  const a = property("p1", "Ten units", 10);
  const b = property("p2", "Units not entered", 0);
  const c = property("p3", "No year built", 6, null);
  const d = property("p4", "Fractional units", 2.5, 1985);
  const rows: ComponentRow[] = [
    component("c1", a.id),
    component("c2", b.id, { install_year: 2000 }),
    component("c3", a.id, { name: "Boiler", category: "HVAC", install_year: null, useful_life_years: 25, replacement_cost_each: 18000 }),
    component("c4", c.id, { install_year: null }),
    component("c5", c.id, { name: "Water heaters", category: "Plumbing", quantity: 6, install_year: 2019, useful_life_years: 10, replacement_cost_each: 1400, install_year_is_estimate: true }),
    component("c6", a.id, { name: "No cost", replacement_cost_each: null }),
    component("c7", d.id, { name: "Carpet", category: "Flooring", quantity: 2400.5, unit_label: "per_sq_ft", install_year: 2021, useful_life_years: 8, replacement_cost_each: 3.75 }),
    component("c8", d.id, { name: "Seal coat", category: "Site", quantity: 8000, install_year: null, useful_life_years: 4, replacement_cost_each: 0.25, scenario: "replace_now" }),
    component("c9", b.id, { name: "Bad life", useful_life_years: 0 }),
    component("c10", d.id, { name: "Roof", install_year: 2024, useful_life_years: 22, replacement_cost_each: 41000.1 }),
  ];

  it("one property at a time", () => {
    const lines: string[] = [];
    for (const p of [a, b, c, d]) {
      const { forecast, excluded } = forecastForProperty(p, rows.filter((r) => r.property_id === p.id), 2026);
      lines.push(`${p.name}: excluded ${excluded}`, ...forecastLines(forecast));
    }
    expect(lines).toMatchSnapshot();
  });

  for (const year of [2026, 2031]) {
    it(`the portfolio in ${year}`, () => {
      const { summaries, totals } = summarizePortfolio([a, b, c, d], rows, year);
      expect([
        ...summaries.map((s) => `${s.property.name}: ${s.componentCount} components, ${s.excluded} left out | ${compactLine(s.forecast)}`),
        `monthly ${n(totals.monthly)} neededNow ${n(totals.neededNow)} atRisk ${totals.atRisk} perUnit ${n(totals.perUnit)}`,
        `missing units: ${totals.missingUnits.map((p) => p.name).join(", ")}`,
      ]).toMatchSnapshot();
    });
  }
});

describe("the home page illustration", () => {
  it("works out its per-unit reserve", () => {
    expect([`perUnit ${n(mockupReservePerUnit())}`, `badge $${Math.ceil(mockupReservePerUnit())}`]).toMatchSnapshot();
  });
});

describe("what if we replace everything at risk now", () => {
  for (const year of [2026, 2027]) {
    it(`on the example building in ${year}`, () => {
      const draft = exampleDraft();
      const key = keysOf(draft);
      const { components } = toComponents(draft, year);
      const unitCount = parseUnitCount(draft.unitCount);
      const first = new Set([components.find((c) => c.name === "Tank water heater")?.id ?? ""]);
      const lines: string[] = [];
      const options: [string, Parameters<typeof compareReplaceNow>[1]][] = [
        ["all", {}],
        ["all +25%", { emergencyPercent: 25 }],
        ["all +500%", { emergencyPercent: 500 }],
        ["all -5%", { emergencyPercent: -5 }],
        ["water heater only", { only: first }],
        ["water heater only +25%", { only: first, emergencyPercent: 25 }],
        ["none", { only: new Set() }],
      ];
      for (const [name, opts] of options) {
        const r = compareReplaceNow({ startYear: year, unitCount, components }, opts);
        const fig = (f: typeof r.asPlanned) =>
          `now ${n(f.neededNow)} total ${n(f.total)} monthly ${n(f.monthlyReserve)} perUnit ${n(f.monthlyReservePerUnit)}`;
        lines.push(
          `${name}: items ${r.items.map((i) => `${key(i.componentId)}:${i.yearsRemaining}`).join(",")} already ${r.alreadyReplacing} chosen ${r.chosen.map(key).join(",")}`,
          `  as planned ${fig(r.asPlanned)}`,
          `  replace now ${fig(r.replaceNow)}`,
        );
      }
      // One already set to replace now is left out of the choices and counted.
      const roofNow = components.map((c) => (c.name === "Refrigerator" ? { ...c, scenario: "replace_now" as const } : c));
      const r = compareReplaceNow({ startYear: year, unitCount: 0, components: roofNow }, { emergencyPercent: 37.5 });
      lines.push(
        `fridge already replacing, no units: items ${r.items.map((i) => key(i.componentId)).join(",")} already ${r.alreadyReplacing}`,
        `  as planned ${n(r.asPlanned.monthlyReserve)} ${n(r.asPlanned.monthlyReservePerUnit)} replace now ${n(r.replaceNow.monthlyReserve)}`,
      );
      expect(lines).toMatchSnapshot();
    });
  }
});

describe("the quick estimate", () => {
  const systems = quickSystems(COMPONENT_LIBRARY, TYPICAL_COSTS);
  const allTicked = new Set(systems.map((s) => s.item.slug));
  for (const [name, ticked] of [["ticked by default", TICKED_BY_DEFAULT], ["everything ticked", allTicked]] as const) {
    for (const spread of [true, false]) {
      it(`${name}, ${spread ? "spread" : "middle of the range"}`, () => {
        const lines: string[] = [`systems ${systems.length}`];
        for (const units of [1, 12, 100000]) {
          for (const yearBuilt of [1800, 1950, 1998, 2020, 2026]) {
            const e = quickEstimate(systems, ticked, units, yearBuilt, 2026, spread);
            if (!e) {
              lines.push(`${units} units, ${yearBuilt}: none`);
              continue;
            }
            const t = estimateText(e, units);
            lines.push(
              `${units} units, ${yearBuilt}: low ${n(e.perUnit.low)} high ${n(e.perUnit.high)} systems ${e.systems} rounded ${roundEstimate(e.perUnit.low)}-${roundEstimate(e.perUnit.high)} | ${t.perUnit} | ${t.building} | ${t.spoken}`,
            );
          }
        }
        expect(lines).toMatchSnapshot();
      });
    }
  }
  it("with nothing that can be priced, or no units", () => {
    expect([
      String(quickEstimate(systems, new Set(), 12, 1998, 2026)),
      String(quickEstimate(systems, TICKED_BY_DEFAULT, 0, 1998, 2026)),
    ]).toMatchSnapshot();
  });
});

describe("the sample condition report", () => {
  it("in 2026", () => {
    const report = sampleReport(2026);
    const key = (id: string) => report.rows.find((r) => r.id === id)?.name ?? id;
    expect([
      `${report.propertyName}, ${report.unitCount} units, built ${report.yearBuilt}`,
      ...report.rows.map(
        (r) =>
          `${r.name} | ${r.category} | ${n(r.quantity)} ${r.unitLabel} | installed ${r.installYear}${r.installYearIsEstimate ? " est" : ""} | age ${r.age} (${ageText(r)}) | life ${r.usefulLife} | eol ${r.endOfLifeYear} | left ${r.remainingLife} (${remainingLifeText(r.remainingLife)}) | ${r.status} ${statusText(r.status)} | ${r.condition} | ${n(r.replacementCost)} | ${r.notes}`,
      ),
      ...forecastLines(report.forecast, key),
    ]).toMatchSnapshot();
  });
});

describe("values that overflow", () => {
  it("a row of 1e200 × 1e200 shows $∞, as today", () => {
    const draft: Draft = {
      unitCount: "12",
      yearBuilt: "1998",
      rows: [
        { id: "big", librarySlug: null, category: "Roofing", name: "Big roof", quantity: "1e200", unitLabel: "per_building", installYear: "2000", usefulLife: "30", costEach: "1e200", scenario: "run_to_failure" },
        { id: "boiler", librarySlug: null, category: "HVAC", name: "Boiler", quantity: "1", unitLabel: "per_building", installYear: "2010", usefulLife: "15", costEach: "9000", scenario: "run_to_failure" },
      ],
    };
    const { components } = toComponents(draft, 2026);
    const f = forecastOf(components, 12, 2026);
    const compare = compareReplaceNow({ startYear: 2026, unitCount: 12, components }, { emergencyPercent: 25 });
    expect([
      ...forecastLines(f),
      `monthly ${formatReserve(f.monthlyReserve)}`,
      `announced: ${forecastSummary(f, 0)}`,
      `compare as planned ${n(compare.asPlanned.total)} ${n(compare.asPlanned.monthlyReserve)} replace now ${n(compare.replaceNow.total)} ${n(compare.replaceNow.monthlyReserve)}`,
    ]).toMatchSnapshot();
  });
});

describe("a corpus of 200 made-up buildings", () => {
  it(`seed ${CORPUS_SEED}`, () => {
    const lines = corpus(CORPUS_SEED, 200).map((c, i) => {
      const f = forecastOf(c.components.map(toComponent), c.unitCount, c.startYear);
      return `${i} ${c.startYear} u${n(c.unitCount)} | ${compactLine(f)}`;
    });
    expect(lines).toMatchSnapshot();
  });
});
