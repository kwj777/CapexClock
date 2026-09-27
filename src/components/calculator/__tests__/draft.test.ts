import { computeForecast } from "@/lib/forecast";
import { customRow, exampleDraft, rowFromLibrary, toComponents, type Draft } from "../draft";
import { COMPONENT_LIBRARY } from "@/lib/library/components";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;

describe("calculator rows to forecast components", () => {
  it("defaults a blank install year to year built and flags it as an estimate", () => {
    const row = { ...rowFromLibrary(waterHeater, "24"), costEach: "$1,400" };
    const { components, problems } = toComponents({ unitCount: "24", yearBuilt: "2014", rows: [row] });
    expect(problems).toEqual({});
    expect(components[0]).toMatchObject({
      quantity: 24,
      installYear: 2014,
      installYearIsEstimate: true,
      usefulLifeYears: 10,
      replacementCostEach: 1400,
    });
  });

  it("uses one row for bulk items: 24 water heaters from 2014 at $1,400", () => {
    const row = { ...rowFromLibrary(waterHeater, "24"), installYear: "2014", costEach: "1400" };
    const { components } = toComponents({ unitCount: "24", yearBuilt: "", rows: [row] });
    const f = computeForecast({ startYear: 2026, unitCount: 24, components });
    expect(f.years[0].total).toBe(33600);
  });

  it("reports incomplete rows instead of guessing", () => {
    const noCost = rowFromLibrary(waterHeater, "4");
    const noYear = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const noName = { ...customRow(), costEach: "100", installYear: "2020", usefulLife: "5" };
    const badLife = { ...rowFromLibrary(waterHeater, "4"), costEach: "900", installYear: "2020", usefulLife: "0" };
    const draft: Draft = { unitCount: "4", yearBuilt: "", rows: [noCost, noYear, noName, badLife] };
    const { components, problems } = toComponents(draft);
    expect(components).toEqual([]);
    expect(Object.values(problems)).toEqual(["missing_install_year", "missing_install_year", "missing_name", "invalid"]);
  });

  it("the example building produces a forecast with every row included", () => {
    const draft = exampleDraft();
    const { components, problems } = toComponents(draft);
    expect(problems).toEqual({});
    expect(components).toHaveLength(draft.rows.length);
  });
});
