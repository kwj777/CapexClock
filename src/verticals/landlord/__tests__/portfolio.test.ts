import type { ComponentCondition } from "../draft/model";
import { byNeedsMoneyFirst, roundUpReserve, summarizePortfolio } from "../portfolio";
import { forecastProperty, type SavedComponent, type SavedProperty } from "../property";
import type { UnitLabel } from "../units";

// Saved rows as the database returns them, extra columns included: the vertical
// reads only the fields it needs. (The app checks that the database's own row types
// fit SavedProperty and SavedComponent.)
type PropertyRow = SavedProperty & {
  user_id: string;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};
type ComponentRow = SavedComponent & {
  library_slug: string | null;
  unit_label: UnitLabel;
  condition: ComponentCondition | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function property(id: string, name: string, unitCount: number): PropertyRow {
  return {
    id,
    user_id: "11111111-1111-1111-1111-111111111111",
    name,
    city: null,
    state: null,
    unit_count: unitCount,
    year_built: 2000,
    created_at: "",
    updated_at: "",
  };
}

function roof(id: string, propertyId: string, overrides: Partial<ComponentRow> = {}): ComponentRow {
  return {
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
  };
}

const tenUnits = property("a0000000-0000-4000-8000-000000000001", "Ten units", 10);
const noUnits = property("a0000000-0000-4000-8000-000000000002", "Units not entered", 0);

describe("portfolio totals", () => {
  it("adds up every property's reserve, needed-now and at-risk items", () => {
    const { summaries, totals } = summarizePortfolio(
      [tenUnits, noUnits],
      [roof("c1", tenUnits.id), roof("c2", noUnits.id, { install_year: 2000 })],
      2026,
    );
    expect(summaries.map((s) => s.componentCount)).toEqual([1, 1]);
    expect(totals.monthly).toBe(summaries[0].forecast.monthlyReserve + summaries[1].forecast.monthlyReserve);
    expect(totals.neededNow).toBe(120_000);
    expect(totals.atRisk).toBe(1);
  });

  it("works out per unit only over properties with a unit count", () => {
    const { summaries, totals } = summarizePortfolio(
      [tenUnits, noUnits],
      [roof("c1", tenUnits.id), roof("c2", noUnits.id)],
      2026,
    );
    // Same roof on both: the portfolio per-unit must match the one property with units,
    // not spread both reserves over its 10 units.
    expect(totals.perUnit).toBeCloseTo(summaries[0].forecast.monthlyReservePerUnit ?? NaN);
    expect(totals.perUnit).toBeCloseTo(totals.monthly / 2 / 10);
    expect(totals.missingUnits.map((p) => p.name)).toEqual(["Units not entered"]);
  });

  it("weights per unit by each property's units", () => {
    const small = property("a0000000-0000-4000-8000-000000000003", "Small", 2);
    const { summaries, totals } = summarizePortfolio(
      [tenUnits, small],
      [roof("c1", tenUnits.id), roof("c3", small.id)],
      2026,
    );
    expect(totals.perUnit).toBeCloseTo(totals.monthly / 12);
    expect(totals.missingUnits).toEqual([]);
    expect(summaries[1].forecast.monthlyReservePerUnit).toBeCloseTo(totals.monthly / 2 / 2);
  });

  it("has no per-unit figure when no property has units", () => {
    const { totals } = summarizePortfolio([noUnits], [roof("c2", noUnits.id)], 2026);
    expect(totals.perUnit).toBeNull();
    expect(totals.missingUnits).toHaveLength(1);
  });

  it("doesn't list a property without units that has nothing to save for", () => {
    const { totals } = summarizePortfolio([tenUnits, noUnits], [roof("c1", tenUnits.id)], 2026);
    expect(totals.missingUnits).toEqual([]);
  });

  it("hands back the property rows it was given, whole", () => {
    const { summaries, totals } = summarizePortfolio([noUnits], [roof("c2", noUnits.id)], 2026);
    expect(summaries[0].property).toBe(noUnits);
    expect(totals.missingUnits[0]).toBe(noUnits);
  });

  it("totals the monthly reserves as each card shows them, rounded up", () => {
    const small = property("a0000000-0000-4000-8000-000000000003", "Small", 2);
    const { summaries, totals } = summarizePortfolio(
      [tenUnits, small],
      [roof("c1", tenUnits.id, { replacement_cost_each: 7_201 }), roof("c3", small.id, { replacement_cost_each: 7_777 })],
      2026,
    );
    // About $60.01 and $64.81: the cards show $61 and $65, so the total must show $126, not $125.
    const cards = summaries.map((s) => Math.ceil(s.forecast.monthlyReserve));
    expect(cards).toEqual([61, 65]);
    expect(Math.ceil(totals.monthly)).toBe(125);
    expect(totals.monthlyRoundedUp).toBe(126);
  });

  it("puts the property that needs the most money this year first, then most at risk, then by name", () => {
    const p = (n: number, name: string) => property(`a0000000-0000-4000-8000-00000000001${n}`, name, 1);
    const [due, risky, building2, building10] = [p(1, "Due now"), p(2, "Risky"), p(3, "Building 2"), p(4, "Building 10")];
    const { summaries } = summarizePortfolio(
      [building10, building2, risky, due],
      [
        roof("c1", due.id, { install_year: 2000 }),
        roof("c2", risky.id, { install_year: 2005 }),
        roof("c3", building2.id),
        roof("c4", building10.id),
      ],
      2026,
    );
    expect([...summaries].sort(byNeedsMoneyFirst).map((s) => s.property.name)).toEqual([
      "Due now",
      "Risky",
      "Building 2",
      "Building 10",
    ]);
  });

  it("rounds a reserve up to the dollar, ignoring float noise", () => {
    expect(roundUpReserve(200.0000000001)).toBe(200);
    expect(roundUpReserve(200.01)).toBe(201);
    expect(roundUpReserve(0)).toBe(0);
  });

  it("checks every unit count before forecasting any property", () => {
    const negative = property("a0000000-0000-4000-8000-000000000004", "Negative", -1);
    expect(() => summarizePortfolio([tenUnits, negative], [], 2026)).toThrow("Unit count can't be negative.");
    expect(() => summarizePortfolio([tenUnits], [], 2026.5)).toThrow("Start year must be a whole year.");
  });
});

/** A small seeded random number generator (mulberry32): the same seed, the same portfolios. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("the portfolio is one forecast per property", () => {
  it("equals forecasting each property on its own, with totals summed in order, on 300 made-up portfolios", () => {
    const rand = seeded(300);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < 300; i++) {
      const startYear = int(2020, 2035);
      const properties: PropertyRow[] = [];
      const rows: ComponentRow[] = [];
      for (let p = 0, count = int(0, 4); p < count; p++) {
        const id = `p${p}`;
        properties.push({ ...property(id, `Property ${p}`, pick([0, 1, 2.5, 12, int(1, 500)])), year_built: rand() < 0.3 ? null : 1990 });
        for (let k = 0, n = int(0, 8); k < n; k++) {
          rows.push(
            roof(`${id}-c${k}`, id, {
              category: pick(["Roofing", "HVAC", "Plumbing"]),
              name: pick(["Roof", "roof", "Boiler", "Carpet"]),
              quantity: pick([1, 12, 0.25, rand() * 1000, 0, Number.NaN]),
              install_year: rand() < 0.2 ? null : int(startYear - 60, startYear + 5),
              ...(rand() < 0.5 ? { install_year_is_estimate: rand() < 0.5 } : {}),
              useful_life_years: pick([1, 4, 10, 22, int(1, 100), 0]),
              replacement_cost_each: rand() < 0.1 ? null : pick([0, 1400, 38000, rand() * 5000]),
              scenario: rand() < 0.2 ? "replace_now" : "run_to_failure",
              sort_order: k,
            }),
          );
        }
      }
      // Rows arrive in any order; each property keeps its own rows' order.
      const shuffled = rows.map((r) => ({ r, key: rand() })).sort((a, b) => a.key - b.key).map((x) => x.r);
      const { summaries, totals } = summarizePortfolio(properties, shuffled, startYear);
      let monthly = 0;
      let neededNow = 0;
      let atRisk = 0;
      summaries.forEach((s, p) => {
        const own = shuffled.filter((r) => r.property_id === properties[p].id);
        const single = forecastProperty(properties[p], own, startYear);
        expect(s.forecast).toEqual(single.forecast);
        expect(s.excluded).toBe(single.excluded);
        expect(s.componentCount).toBe(own.length);
        monthly += single.forecast.monthlyReserve;
        neededNow += single.forecast.neededNow;
        atRisk += single.forecast.atRisk.length;
      });
      expect(Object.is(totals.monthly, monthly)).toBe(true);
      expect(Object.is(totals.neededNow, neededNow)).toBe(true);
      expect(totals.atRisk).toBe(atRisk);
    }
  });
});

describe("a property's safety buffer", () => {
  it("raises that property's monthly reserve in the portfolio, its own page and the totals", () => {
    const padded = { ...tenUnits, safety_buffer: 20 };
    const rows = [roof("c1", tenUnits.id)];
    const plain = summarizePortfolio([tenUnits], rows, 2026).summaries[0].forecast;
    const { summaries, totals } = summarizePortfolio([padded], rows, 2026);
    expect(summaries[0].forecast.monthlyReserve).toBeCloseTo(plain.monthlyReserve * 1.2, 9);
    expect(summaries[0].forecast).toEqual(forecastProperty(padded, rows, 2026).forecast);
    expect(totals.monthly).toBe(summaries[0].forecast.monthlyReserve);
    expect(totals.perUnit).toBeCloseTo(summaries[0].forecast.monthlyReserve / 10, 9);
  });

  it("is none when missing (before update 0007) or not one of the choices", () => {
    const rows = [roof("c1", tenUnits.id)];
    const plain = forecastProperty(tenUnits, rows, 2026).forecast.monthlyReserve;
    expect(forecastProperty({ ...tenUnits, safety_buffer: 50 }, rows, 2026).forecast.monthlyReserve).toBe(plain);
  });
});
