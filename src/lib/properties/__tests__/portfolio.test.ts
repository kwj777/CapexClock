import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { forecastForProperty } from "../convert";
import { summarizePortfolio } from "../portfolio";

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
    expect(totals.monthly).toBeCloseTo(summaries[0].forecast.monthlyReserve + summaries[1].forecast.monthlyReserve);
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
});

describe("forecasting a saved property", () => {
  it("leaves out a row the forecast can't use instead of failing the page", () => {
    const rows = [
      roof("c1", tenUnits.id),
      roof("c2", tenUnits.id, { quantity: Number("NaN") }),
      roof("c3", tenUnits.id, { replacement_cost_each: Infinity }),
    ];
    const { forecast, excluded } = forecastForProperty(tenUnits, rows, 2026);
    expect(excluded).toBe(2);
    expect(Number.isFinite(forecast.monthlyReserve)).toBe(true);
  });
});
