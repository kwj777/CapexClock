import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { landlordForecast } from "../forecast";
import { assetGroupFromSaved, forecastProperty } from "../property";

// Saved rows as the database returns them: the vertical reads only the fields it
// needs, so the database's own row types are passed straight in.
const property: PropertyRow = {
  id: "8f5a2b9e-1c3d-4e5f-8a9b-0c1d2e3f4a5b",
  user_id: "11111111-1111-1111-1111-111111111111",
  name: "Maple Court",
  city: null,
  state: null,
  unit_count: 12,
  year_built: 1998,
  created_at: "",
  updated_at: "",
};

function component(overrides: Partial<ComponentRow>): ComponentRow {
  return {
    id: "0e9a1a52-5c1b-4f4e-9d38-7a1f1f0d9c11",
    property_id: property.id,
    library_slug: "tank-water-heater",
    category: "Plumbing",
    name: "Tank water heater",
    quantity: 12,
    unit_label: "per_unit",
    install_year: 2016,
    useful_life_years: 10,
    replacement_cost_each: 1400,
    condition: null,
    notes: null,
    scenario: "run_to_failure",
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("a saved property as an asset group", () => {
  it("keeps the property's id and name, and each usable row as a component in row order", () => {
    const rows = [component({ id: "b" }), component({ id: "a", name: "Second", scenario: "replace_now" })];
    const { group, excluded } = assetGroupFromSaved(property, rows);
    expect(group.id).toBe(property.id);
    expect(group.name).toBe("Maple Court");
    expect(group.components.map((c) => [c.id, c.name, c.scenario])).toEqual([
      ["b", "Tank water heater", "run_to_failure"],
      ["a", "Second", "replace_now"],
    ]);
    expect(group.components[0]).toMatchObject({ category: "Plumbing", quantity: 12, installYear: 2016, usefulLifeYears: 10, replacementCostEach: 1400 });
    expect(excluded).toBe(0);
  });

  it("uses year built for a blank install year, and marks it an estimate", () => {
    const { group } = assetGroupFromSaved(property, [component({ install_year: null })]);
    expect(group.components[0].installYear).toBe(1998);
    expect(group.components[0].estimated).toEqual({ installYear: true });
  });

  it("leaves out rows with no cost, or no install year and no year built, and counts them", () => {
    const noYearBuilt = { ...property, year_built: null };
    const rows = [component({ id: "ok" }), component({ id: "noCost", replacement_cost_each: null }), component({ id: "noYear", install_year: null })];
    expect(assetGroupFromSaved(property, rows).excluded).toBe(1);
    const { group, excluded } = assetGroupFromSaved(noYearBuilt, rows);
    expect(group.components.map((c) => c.id)).toEqual(["ok"]);
    expect(excluded).toBe(2);
  });
});

describe("forecasting a saved property", () => {
  it("forecasts saved rows, using year built for blank install years and skipping blank costs", () => {
    const rows = [
      component({}),
      component({ id: "b1d7c1e2-0000-4000-8000-000000000002", install_year: null }), // 1998 -> overdue
      component({ id: "b1d7c1e2-0000-4000-8000-000000000003", replacement_cost_each: null }),
    ];
    const { forecast, excluded } = forecastProperty(property, rows, 2026);
    expect(excluded).toBe(1);
    expect(forecast.neededNow).toBe(2 * 12 * 1400);
    expect(forecast.atRisk.find((r) => r.status === "overdue")?.estimated.installYear).toBe(true);
    expect(forecast.unitCount).toBe(12);
  });

  it("loads rows from a database without update 0004 as not a guess", () => {
    const before0004 = component({});
    expect(before0004).not.toHaveProperty("install_year_is_estimate");
    expect(forecastProperty(property, [before0004], 2026).forecast.atRisk[0].estimated.installYear).toBe(false);
  });

  it("marks a guessed install year as an estimate in the forecast", () => {
    const rows = [
      component({ install_year: 2015, install_year_is_estimate: true }),
      component({ id: "b1d7c1e2-0000-4000-8000-000000000007", install_year: 2015 }),
    ];
    const { forecast } = forecastProperty(property, rows, 2026);
    expect(forecast.atRisk.map((r) => r.estimated.installYear)).toEqual([true, false]);
  });

  it("leaves out a row the forecast can't use instead of failing the page", () => {
    const rows = [
      component({ id: "c1" }),
      component({ id: "c2", quantity: Number("NaN") }),
      component({ id: "c3", replacement_cost_each: Infinity }),
      component({ id: "c4", useful_life_years: 0 }),
    ];
    const { forecast, excluded } = forecastProperty(property, rows, 2026);
    expect(excluded).toBe(3);
    expect(Number.isFinite(forecast.monthlyReserve)).toBe(true);
  });

  it("is the landlord forecast of the property's asset group", () => {
    const rows = [component({}), component({ id: "x", install_year: null, install_year_is_estimate: false })];
    const { group } = assetGroupFromSaved(property, rows);
    expect(forecastProperty(property, rows, 2026).forecast).toEqual(landlordForecast(group.components, 12, 2026));
  });

  it("refuses a negative unit count, as a forecast does", () => {
    expect(() => forecastProperty({ ...property, unit_count: -1 }, [], 2026)).toThrow("Unit count can't be negative.");
  });
});
