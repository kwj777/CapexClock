import { computeForecast } from "@/lib/forecast";
import {
  customRow,
  exampleDraft,
  parseUnitCount,
  rowFromLibrary,
  toComponents,
  withUnitCount,
  type Draft,
} from "../draft";
import { COMPONENT_LIBRARY } from "@/lib/library/components";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;

describe("calculator rows to forecast components", () => {
  it("defaults a blank install year to year built and flags it as an estimate", () => {
    const row = { ...rowFromLibrary(waterHeater, "24"), costEach: "$1,400" };
    const { components, problems } = toComponents({ unitCount: "24", yearBuilt: "2014", rows: [row] }, 2026);
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
    const { components } = toComponents({ unitCount: "24", yearBuilt: "", rows: [row] }, 2026);
    const f = computeForecast({ startYear: 2026, unitCount: 24, components });
    expect(f.years[0].total).toBe(33600);
  });

  it("reports incomplete rows instead of guessing", () => {
    const noCost = rowFromLibrary(waterHeater, "4");
    const noYear = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const noName = { ...customRow(), costEach: "100", installYear: "2020", usefulLife: "5" };
    const badLife = { ...rowFromLibrary(waterHeater, "4"), costEach: "900", installYear: "2020", usefulLife: "0" };
    const draft: Draft = { unitCount: "4", yearBuilt: "", rows: [noCost, noYear, noName, badLife] };
    const { components, problems } = toComponents(draft, 2026);
    expect(components).toEqual([]);
    expect(Object.values(problems)).toEqual(["missing_install_year", "missing_install_year", "missing_name", "invalid"]);
  });

  it("the example building produces a forecast with every row included", () => {
    const draft = exampleDraft();
    const { components, problems } = toComponents(draft, 2026);
    expect(problems).toEqual({});
    expect(components).toHaveLength(draft.rows.length);
  });

  it("rejects install-year typos instead of treating them as ancient or future", () => {
    const rows = ["98", "2106", "2031", "2016.5"].map((installYear) => ({
      ...rowFromLibrary(waterHeater, "4"),
      costEach: "900",
      installYear,
    }));
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "", rows }, 2026);
    expect(components).toEqual([]);
    expect(Object.values(problems)).toEqual(Array(4).fill("bad_install_year"));
  });

  it("checks a defaulted year built the same way", () => {
    const row = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const { problems } = toComponents({ unitCount: "4", yearBuilt: "98", rows: [row] }, 2026);
    expect(Object.values(problems)).toEqual(["bad_install_year"]);
  });

  it("flags a cost it can't read as invalid, not missing", () => {
    const row = { ...rowFromLibrary(waterHeater, "4"), installYear: "2016", costEach: "1.4k" };
    const { problems } = toComponents({ unitCount: "4", yearBuilt: "", rows: [row] }, 2026);
    expect(Object.values(problems)).toEqual(["invalid"]);
  });
});

describe("unit count", () => {
  it("reads commas and never goes negative", () => {
    expect(parseUnitCount("1,200")).toBe(1200);
    expect(parseUnitCount("-5")).toBe(0);
    expect(parseUnitCount("")).toBe(0);
    expect(parseUnitCount("abc")).toBe(0);
  });

  it("carries a new unit count to per-unit rows still at the old count", () => {
    const untouched = rowFromLibrary(waterHeater, "12");
    const edited = { ...rowFromLibrary(waterHeater, "12"), quantity: "6" };
    const roof = COMPONENT_LIBRARY.find((c) => c.unitLabel === "per_building")!;
    const perBuilding = rowFromLibrary(roof, "12");
    const next = withUnitCount({ unitCount: "12", yearBuilt: "", rows: [untouched, edited, perBuilding] }, "14");
    expect(next.rows.map((r) => r.quantity)).toEqual(["14", "6", "1"]);
  });
});
