import { editRow, exampleDraft, withUnitCount } from "@/components/calculator/draft";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { draftFromRows, forecastForProperty, saveProblemFields, toSaveInput } from "../convert";

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

describe("saving an editor draft", () => {
  it("keeps saved component ids and drops temporary ones", () => {
    const draft = exampleDraft();
    draft.rows[0] = { ...draft.rows[0], id: "0e9a1a52-5c1b-4f4e-9d38-7a1f1f0d9c11" };
    const input = toSaveInput("  Maple Court ", draft, 2026, property.id);
    expect(input.problems).toEqual({});
    expect(input.property).toEqual({ id: property.id, name: "Maple Court", unit_count: 12, year_built: 1998 });
    expect(input.components[0].id).toBe("0e9a1a52-5c1b-4f4e-9d38-7a1f1f0d9c11");
    expect(input.components[1]).not.toHaveProperty("id");
    expect(input.components.map((c) => c.sort_order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("saves rows with a blank cost or install year instead of dropping them", () => {
    const draft = exampleDraft();
    draft.rows = [{ ...draft.rows[0], costEach: "", installYear: "" }];
    const input = toSaveInput("x", draft, 2026);
    expect(input.problems).toEqual({});
    expect(input.components[0]).toMatchObject({ replacement_cost_each: null, install_year: null });
  });

  it("reports what the database would reject", () => {
    const draft = exampleDraft();
    const [a, b, c, d, e] = draft.rows;
    draft.rows = [
      { ...a, name: " " },
      { ...b, quantity: "0" },
      { ...c, usefulLife: "2.5" },
      { ...d, installYear: "98" },
      { ...e, costEach: "1.4k" },
    ];
    draft.yearBuilt = "3000";
    const input = toSaveInput("", draft, 2026);
    expect(input.components).toEqual([]);
    expect(input.problems).toEqual({
      property: "year_built",
      [a.id]: "name",
      [b.id]: "quantity",
      [c.id]: "life",
      [d.id]: "install_year",
      [e.id]: "cost",
    });
    expect(input.property.name).toBe("Untitled property");
  });

  it("accepts a year built back to 1800, as the database does", () => {
    const draft = { ...exampleDraft(), yearBuilt: "1890" };
    expect(toSaveInput("x", draft, 2026).problems).toEqual({});
    expect(toSaveInput("x", { ...draft, yearBuilt: "1799" }, 2026).problems).toEqual({ property: "year_built" });
  });

  it("reports values over the database's limits instead of failing the save", () => {
    const draft = exampleDraft();
    const [a, b, c] = draft.rows;
    draft.rows = [
      { ...a, name: "x".repeat(201) },
      { ...b, quantity: "1e400" },
      { ...c, costEach: "2000000000000" },
    ];
    draft.unitCount = "150000";
    const input = toSaveInput("x", draft, 2026);
    expect(input.problems).toEqual({
      property: "unit_count",
      [a.id]: "name_length",
      [b.id]: "quantity",
      [c.id]: "cost",
    });
    expect(input.property.unit_count).toBe(0);
  });

  it("accepts values right at the limits", () => {
    const draft = exampleDraft();
    draft.rows = [{ ...draft.rows[0], name: "x".repeat(200), quantity: "999999999", costEach: "999999999999" }];
    draft.unitCount = "100000";
    expect(toSaveInput("x", draft, 2026).problems).toEqual({});
  });

  it("points each row problem at the field it's about", () => {
    expect(saveProblemFields("name_length")).toEqual(["name"]);
    expect(saveProblemFields("quantity")).toEqual(["quantity"]);
    expect(saveProblemFields("life")).toEqual(["usefulLife"]);
    expect(saveProblemFields("install_year")).toEqual(["installYear"]);
    expect(saveProblemFields("cost")).toEqual(["costEach"]);
    expect(saveProblemFields("unit_count")).toEqual([]);
  });
});

describe("loading a saved property", () => {
  it("round-trips through the editor draft", () => {
    const rows = [component({ sort_order: 1 }), component({ id: "b1d7c1e2-0000-4000-8000-000000000001", name: "Roof", sort_order: 0, install_year: null, replacement_cost_each: null })];
    const draft = draftFromRows(property, rows);
    expect(draft.rows.map((r) => r.name)).toEqual(["Roof", "Tank water heater"]);
    expect(draft.rows[0]).toMatchObject({ installYear: "", costEach: "" });
    const back = toSaveInput(property.name, draft, 2026, property.id);
    expect(back.components.map((c) => c.id)).toEqual(rows.map((r) => r.id).reverse());
  });

  it("lets per-unit rows at the unit count follow it, and keeps other quantities as saved", () => {
    const rows = [
      component({}),
      component({ id: "b1d7c1e2-0000-4000-8000-000000000004", library_slug: "washer-dryer", name: "Washer / dryer", quantity: 1, sort_order: 1 }),
      component({ id: "b1d7c1e2-0000-4000-8000-000000000005", unit_label: "per_building", quantity: 12, sort_order: 2 }),
    ];
    const draft = draftFromRows(property, rows);
    expect(draft.rows.map((r) => r.followsUnitCount)).toEqual([true, false, false]);
    const typed = ["1", "14"].reduce(withUnitCount, draft);
    expect(typed.rows.map((r) => r.quantity)).toEqual(["14", "1", "12"]);
    // Once the owner types a quantity it stays put.
    const edited = { ...typed, rows: typed.rows.map((r, i) => (i === 0 ? editRow(r, { quantity: "10" }, typed.unitCount) : r)) };
    expect(withUnitCount(edited, "16").rows[0].quantity).toBe("10");
    // What's saved is unchanged: no new fields reach the database.
    expect(Object.keys(toSaveInput("x", typed, 2026, property.id).components[0]).sort()).toEqual(
      ["category", "id", "install_year", "library_slug", "name", "quantity", "replacement_cost_each", "scenario", "sort_order", "unit_label", "useful_life_years"],
    );
  });

  it("forecasts saved rows, using year built for blank install years and skipping blank costs", () => {
    const rows = [
      component({}),
      component({ id: "b1d7c1e2-0000-4000-8000-000000000002", install_year: null }), // 1998 -> overdue
      component({ id: "b1d7c1e2-0000-4000-8000-000000000003", replacement_cost_each: null }),
    ];
    const { forecast, excluded } = forecastForProperty(property, rows, 2026);
    expect(excluded).toBe(1);
    expect(forecast.neededNow).toBe(2 * 12 * 1400);
    expect(forecast.atRisk.find((r) => r.status === "overdue")?.installYearIsEstimate).toBe(true);
  });
});
