import { parseLibraryRows } from "../source";

describe("component library rows from Supabase", () => {
  it("maps valid rows and skips malformed ones", () => {
    const rows = [
      { slug: "boiler", category: "HVAC", name: "Boiler", default_useful_life_low: 20, default_useful_life_high: 30, default_unit_label: "per_building" },
      { slug: "Bad Slug", category: "HVAC", name: "x", default_useful_life_low: 1, default_useful_life_high: 2, default_unit_label: "per_unit" },
      { slug: "backwards", category: "HVAC", name: "x", default_useful_life_low: 9, default_useful_life_high: 2, default_unit_label: "per_unit" },
      { slug: "odd-unit", category: "HVAC", name: "x", default_useful_life_low: 1, default_useful_life_high: 2, default_unit_label: "per_room" },
      null,
    ];
    expect(parseLibraryRows(rows)).toEqual([
      { slug: "boiler", category: "HVAC", name: "Boiler", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" },
    ]);
  });

  it("returns nothing for a non-array response", () => {
    expect(parseLibraryRows({ message: "error" })).toEqual([]);
  });
});
