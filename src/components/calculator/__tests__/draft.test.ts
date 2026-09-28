import { computeForecast } from "@/lib/forecast";
import {
  badYearBuilt,
  costLabel,
  customRow,
  editRow,
  exampleDraft,
  parseUnitCount,
  rowFromLibrary,
  rowTotal,
  toComponents,
  upgradeDraft,
  withLibraryItem,
  withUnitCount,
  type Draft,
  type DraftRow,
} from "../draft";
import { COMPONENT_LIBRARY } from "@/lib/library/components";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const washer = COMPONENT_LIBRARY.find((c) => c.slug === "washer-dryer")!;
const roof = COMPONENT_LIBRARY.find((c) => c.slug === "asphalt-shingle-roof")!;
const carpet = COMPONENT_LIBRARY.find((c) => c.slug === "carpet")!;

/** Types a unit count one keystroke at a time, the way the input's onChange sees it. */
function typeUnitCount(draft: Draft, ...values: string[]): Draft {
  return values.reduce(withUnitCount, draft);
}

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

  it("blames year built, not the row, when a blank install year falls back to a bad year built", () => {
    const blank = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const dated = { ...blank, id: "dated", installYear: "2020" };
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "98", rows: [blank, dated] }, 2026);
    expect(problems).toEqual({ [blank.id]: "bad_year_built" });
    expect(components.map((c) => c.id)).toEqual(["dated"]);
  });

  it("accepts a year built back to 1800 for rows without an install year", () => {
    const blank = { ...rowFromLibrary(waterHeater, "4"), costEach: "900" };
    const { components, problems } = toComponents({ unitCount: "4", yearBuilt: "1890", rows: [blank] }, 2026);
    expect(problems).toEqual({});
    expect(components[0]).toMatchObject({ installYear: 1890, installYearIsEstimate: true });
  });

  it("still keeps typed install years to 1900 or later", () => {
    const old = { ...rowFromLibrary(waterHeater, "4"), costEach: "900", installYear: "1890" };
    const { problems } = toComponents({ unitCount: "4", yearBuilt: "1890", rows: [old] }, 2026);
    expect(Object.values(problems)).toEqual(["bad_install_year"]);
  });

  it("checks year built on its own", () => {
    expect(badYearBuilt("", 2026)).toBe(false);
    expect(badYearBuilt("1800", 2026)).toBe(false);
    expect(badYearBuilt("2026", 2026)).toBe(false);
    for (const bad of ["98", "1799", "2027", "1998.5", "abc"]) expect(badYearBuilt(bad, 2026)).toBe(true);
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

  it("carries a new unit count to per-unit rows that follow it", () => {
    const untouched = rowFromLibrary(waterHeater, "12");
    const edited = editRow(rowFromLibrary(waterHeater, "12"), { quantity: "6" }, "12");
    const perBuilding = rowFromLibrary(roof, "12");
    const next = withUnitCount({ unitCount: "12", yearBuilt: "", rows: [untouched, edited, perBuilding] }, "14");
    expect(next.rows.map((r) => r.quantity)).toEqual(["14", "6", "1"]);
  });

  it("never rewrites a quantity the owner set, whatever the count passes through on the way (12 -> 1 -> 14)", () => {
    const heaters = rowFromLibrary(waterHeater, "12");
    const sharedWasher = editRow(rowFromLibrary(washer, "12"), { quantity: "1" }, "12");
    const draft: Draft = { unitCount: "12", yearBuilt: "", rows: [heaters, sharedWasher] };
    expect(typeUnitCount(draft, "1", "14").rows.map((r) => r.quantity)).toEqual(["14", "1"]);
    expect(typeUnitCount(draft, "1", "16").rows.map((r) => r.quantity)).toEqual(["16", "1"]);
    expect(typeUnitCount(draft, "", "1", "18").rows.map((r) => r.quantity)).toEqual(["18", "1"]);
  });

  it("keeps a typed quantity even when it matches a count typed on the way", () => {
    const two = editRow(rowFromLibrary(washer, ""), { quantity: "2" }, "");
    const next = typeUnitCount({ unitCount: "", yearBuilt: "", rows: [two] }, "2", "24");
    expect(next.rows[0].quantity).toBe("2");
  });

  it("fills in per-unit rows added before the unit count", () => {
    const early = rowFromLibrary(waterHeater, "");
    expect(early.quantity).toBe("");
    const next = typeUnitCount({ unitCount: "", yearBuilt: "", rows: [early] }, "1", "12");
    expect(next.rows[0].quantity).toBe("12");
  });
});

describe("how a row is counted", () => {
  const draftRow = (): DraftRow => rowFromLibrary(waterHeater, "12");

  it("per building means one of them, and stops following the unit count", () => {
    const row = editRow(draftRow(), { unitLabel: "per_building" }, "12");
    expect(row).toMatchObject({ quantity: "1", followsUnitCount: false });
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [row] }, "14").rows[0].quantity).toBe("1");
  });

  it("per unit takes the unit count and follows it", () => {
    const row = editRow(rowFromLibrary(roof, "12"), { unitLabel: "per_unit" }, "12");
    expect(row).toMatchObject({ quantity: "12", followsUnitCount: true });
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [row] }, "14").rows[0].quantity).toBe("14");
  });

  it("per sq ft clears the quantity for the owner to fill in", () => {
    expect(editRow(draftRow(), { unitLabel: "per_sq_ft" }, "12")).toMatchObject({ quantity: "", followsUnitCount: false });
    expect(rowFromLibrary(carpet, "12")).toMatchObject({ quantity: "", followsUnitCount: false });
  });

  it("leaves the quantity alone when another field changes", () => {
    const row = editRow(draftRow(), { costEach: "1400" }, "12");
    expect(row).toMatchObject({ quantity: "12", followsUnitCount: true, costEach: "1400" });
  });

  it("labels the cost by what it pays for", () => {
    expect(costLabel("per_unit")).toBe("Cost per apartment");
    expect(costLabel("per_building")).toBe("Cost for the building");
    expect(costLabel("per_sq_ft")).toBe("Cost per sq ft");
  });

  it("shows the row total once quantity and cost are readable", () => {
    expect(rowTotal({ quantity: "12", costEach: "$650" })).toEqual({ quantity: 12, each: 650, total: 7800 });
    expect(rowTotal({ quantity: "", costEach: "650" })).toBeNull();
    expect(rowTotal({ quantity: "12", costEach: "1.4k" })).toBeNull();
  });
});

describe("drafts saved before the follow flag", () => {
  it("treat per-unit rows at the unit count as following it, and others as set by hand", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [
        { id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "12", unitLabel: "per_unit", installYear: "", usefulLife: "10", costEach: "", scenario: "run_to_failure" },
        { id: "b", librarySlug: null, category: "Appliances", name: "Washer", quantity: "1", unitLabel: "per_unit", installYear: "", usefulLife: "12", costEach: "", scenario: "run_to_failure" },
      ],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows.map((r) => r.followsUnitCount)).toEqual([true, false]);
    expect(typeUnitCount(upgraded, "1", "14").rows.map((r) => r.quantity)).toEqual(["14", "1"]);
  });

  it("count a forecast the older draft already showed as tracked", () => {
    expect(upgradeDraft(exampleDraft(), 2026).forecastTracked).toBe(true);
    expect(upgradeDraft({ unitCount: "", yearBuilt: "", rows: [rowFromLibrary(roof, "")] }, 2026).forecastTracked).toBe(false);
    expect(upgradeDraft({ ...exampleDraft(), forecastTracked: false }, 2026).forecastTracked).toBe(false);
  });

  it("the example follows its unit count", () => {
    const draft = exampleDraft();
    const next = withUnitCount(draft, "14");
    expect(next.rows.filter((r) => r.unitLabel === "per_unit").map((r) => r.quantity)).toEqual(["14", "14", "14"]);
  });
});

describe("adding from a lifespan page", () => {
  const typed = { installYear: "2016", quantity: "", costEach: "1400" };

  it("appends a row that follows the unit count when no quantity was typed", () => {
    const next = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [] }, waterHeater, typed, "add");
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0]).toMatchObject({ librarySlug: "tank-water-heater", quantity: "12", followsUnitCount: true, installYear: "2016", costEach: "1400" });
    expect(next.forecastTracked).toBe(false);
  });

  it("keeps a typed quantity as set by hand", () => {
    const next = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [] }, waterHeater, { ...typed, quantity: "6" }, "add");
    expect(next.rows[0]).toMatchObject({ quantity: "6", followsUnitCount: false });
  });

  it("updates the row the draft already has instead of adding a second one", () => {
    const draft = { ...exampleDraft(), forecastTracked: true };
    const before = draft.rows.find((r) => r.librarySlug === "tank-water-heater")!;
    const next = withLibraryItem(draft, waterHeater, { installYear: "2021", quantity: "", costEach: "" }, "update");
    expect(next.rows).toHaveLength(draft.rows.length);
    expect(next.rows.find((r) => r.id === before.id)).toMatchObject({ installYear: "2021", quantity: "12", costEach: "1400" });
    expect(next.forecastTracked).toBe(true);
  });

  it("can still add a second one on purpose", () => {
    const draft = exampleDraft();
    const next = withLibraryItem(draft, waterHeater, typed, "add");
    expect(next.rows.filter((r) => r.librarySlug === "tank-water-heater")).toHaveLength(2);
  });
});
