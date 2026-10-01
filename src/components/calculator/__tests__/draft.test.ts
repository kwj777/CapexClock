import { computeForecast } from "@/lib/forecast";
import {
  badYearBuilt,
  cleanDetails,
  costLabel,
  customRow,
  detailsSummary,
  editRow,
  EMPTY_DRAFT,
  exampleDraft,
  hasEntries,
  neighborRowId,
  notesLeftText,
  parseUnitCount,
  PROBLEM_TEXT,
  problemFields,
  problemText,
  rowFromLibrary,
  rowTotal,
  STORAGE_KEY,
  toComponents,
  upgradeDraft,
  withLibraryItem,
  withUnitCount,
  type Draft,
  type DraftRow,
} from "../draft";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import { DRAFT_STORAGE_KEY } from "../storage-key";

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

describe("pointing a row's note at the field it's about", () => {
  const dated = { ...rowFromLibrary(waterHeater, "4"), installYear: "2016", costEach: "900" };

  it("names the one field that's missing or out of range", () => {
    const cases: [DraftRow, string][] = [
      [{ ...dated, name: " " }, "name"],
      [{ ...dated, installYear: "" }, "installYear"],
      [{ ...dated, installYear: "98" }, "installYear"],
      [{ ...dated, costEach: "" }, "costEach"],
    ];
    for (const [row, field] of cases) {
      const problem = toComponents({ unitCount: "4", yearBuilt: "", rows: [row] }, 2026).problems[row.id];
      expect(problemFields(row, problem)).toEqual([field]);
    }
  });

  it("sends a blank install year to the install year when year built is the trouble", () => {
    const row = { ...dated, installYear: "" };
    const problem = toComponents({ unitCount: "4", yearBuilt: "98", rows: [row] }, 2026).problems[row.id];
    expect(problem).toBe("bad_year_built");
    expect(problemFields(row, problem)).toEqual(["installYear"]);
  });

  it("says which number can't be used instead of listing all three", () => {
    const badCost = { ...dated, costEach: "1.4k" };
    expect(problemFields(badCost, "invalid")).toEqual(["costEach"]);
    expect(problemText(badCost, "invalid")).toBe("Cost should be a plain number, like 1400.");

    const badLifeAndQty = { ...dated, quantity: "twelve", usefulLife: "0" };
    expect(problemFields(badLifeAndQty, "invalid")).toEqual(["quantity", "usefulLife"]);
    expect(problemText(badLifeAndQty, "invalid")).toBe(
      "Quantity should be a number above 0, like 12. Useful life should be a whole number of years from 1 to 100.",
    );

    const badSqFt = { ...rowFromLibrary(carpet, "4"), quantity: "-5", installYear: "2020", costEach: "4" };
    expect(problemText(badSqFt, "invalid")).toBe("Square feet should be a number above 0, like 1200.");
  });

  it("keeps the fixed wording for the other problems", () => {
    expect(problemText(dated, "missing_cost")).toBe(PROBLEM_TEXT.missing_cost);
  });
});

describe("after removing a row", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("moves to the next row, or the one before when it was last", () => {
    expect(neighborRowId(rows, "a")).toBe("b");
    expect(neighborRowId(rows, "b")).toBe("c");
    expect(neighborRowId(rows, "c")).toBe("b");
  });

  it("has nowhere to go when it was the only row", () => {
    expect(neighborRowId([{ id: "a" }], "a")).toBeNull();
    expect(neighborRowId(rows, "missing")).toBeNull();
  });
});

describe("what Clear and Load an example would replace", () => {
  it("is nothing for an empty draft, so there's no undo to offer", () => {
    expect(hasEntries(EMPTY_DRAFT)).toBe(false);
    expect(hasEntries({ ...EMPTY_DRAFT, unitCount: " " })).toBe(false);
  });

  it("counts rows, a unit count or a year built", () => {
    expect(hasEntries(exampleDraft())).toBe(true);
    expect(hasEntries({ ...EMPTY_DRAFT, unitCount: "40" })).toBe(true);
    expect(hasEntries({ ...EMPTY_DRAFT, yearBuilt: "1962" })).toBe(true);
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

  // Some browsers change a closed picker on every arrow key, so each step is an edit.
  const pick = (row: DraftRow, ...labels: DraftRow["unitLabel"][]) =>
    labels.reduce((r, unitLabel) => editRow(r, { unitLabel }, "12"), row);

  it("keeps a typed quantity when the owner arrows through the picker and back", () => {
    const windows = editRow(draftRow(), { quantity: "90" }, "12");
    expect(pick(windows, "per_building")).toMatchObject({ quantity: "90", followsUnitCount: false });
    expect(pick(windows, "per_building", "per_unit")).toMatchObject({ quantity: "90", followsUnitCount: false });
    expect(pick(windows, "per_building", "per_sq_ft", "per_building", "per_unit").quantity).toBe("90");
    expect(pick(editRow(rowFromLibrary(carpet, "12"), { quantity: "9600" }, "12"), "per_unit", "per_sq_ft").quantity).toBe("9600");
  });

  it("gives a starting quantity back when the owner arrows through and back", () => {
    const row = pick(draftRow(), "per_building", "per_sq_ft", "per_building", "per_unit");
    expect(row).toMatchObject({ quantity: "12", followsUnitCount: true });
    expect(pick(rowFromLibrary(roof, "12"), "per_sq_ft", "per_unit", "per_building").quantity).toBe("1");
  });

  it("counts a typed quantity as the owner's after a picker change, so the unit count leaves it alone", () => {
    const row = pick(editRow(draftRow(), { quantity: "90" }, "12"), "per_building", "per_unit");
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [row] }, "14").rows[0].quantity).toBe("90");
    expect(costLabel(row)).toBe("Cost each");
  });

  it("leaves the quantity alone when another field changes", () => {
    const row = editRow(draftRow(), { costEach: "1400" }, "12");
    expect(row).toMatchObject({ quantity: "12", followsUnitCount: true, costEach: "1400" });
  });

  it("labels the cost by what it pays for", () => {
    expect(costLabel(rowFromLibrary(washer, "12"))).toBe("Cost per apartment");
    expect(costLabel(rowFromLibrary(roof, "12"))).toBe("Cost for the building");
    expect(costLabel(rowFromLibrary(carpet, "12"))).toBe("Cost per sq ft");
    expect(costLabel(editRow(draftRow(), { unitLabel: "per_sq_ft" }, "12"))).toBe("Cost per sq ft");
  });

  it("labels the cost each once the owner sets their own count", () => {
    expect(costLabel(editRow(rowFromLibrary(washer, "12"), { quantity: "1" }, "12"))).toBe("Cost each");
    expect(costLabel(editRow(rowFromLibrary(roof, "12"), { quantity: "2" }, "12"))).toBe("Cost each");
    expect(costLabel(customRow())).toBe("Cost for the building");
  });

  it("shows the row total once quantity and cost are readable", () => {
    expect(rowTotal({ quantity: "12", costEach: "$650" })).toEqual({ quantity: 12, each: 650, total: 7800 });
    expect(rowTotal({ quantity: "", costEach: "650" })).toBeNull();
    expect(rowTotal({ quantity: "12", costEach: "1.4k" })).toBeNull();
  });
});

describe("condition, notes and a guessed install year", () => {
  const row = { ...rowFromLibrary(waterHeater, "12"), installYear: "2016", costEach: "1400" };

  it("treats a ticked guess as an estimate, like a blank year", () => {
    const draft = (r: DraftRow): Draft => ({ unitCount: "12", yearBuilt: "1998", rows: [r] });
    expect(toComponents(draft(row), 2026).components[0].installYearIsEstimate).toBe(false);
    expect(toComponents(draft({ ...row, installYearIsGuess: true }), 2026).components[0]).toMatchObject({
      installYear: 2016,
      installYearIsEstimate: true,
    });
    expect(toComponents(draft({ ...row, installYear: "" }), 2026).components[0]).toMatchObject({
      installYear: 1998,
      installYearIsEstimate: true,
    });
  });

  it("leaves the math alone: condition and notes don't change the forecast", () => {
    const plain = toComponents({ unitCount: "12", yearBuilt: "", rows: [row] }, 2026).components;
    const noted = toComponents(
      { unitCount: "12", yearBuilt: "", rows: [{ ...row, condition: "poor", notes: "Leaking" }] },
      2026,
    ).components;
    expect(noted).toEqual(plain);
  });

  it("keeps them when other fields change", () => {
    const noted: DraftRow = { ...row, condition: "fair", notes: "Leaking", installYearIsGuess: true };
    expect(editRow(noted, { quantity: "10" }, "12")).toMatchObject({ condition: "fair", notes: "Leaking", installYearIsGuess: true });
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [noted] }, "14").rows[0]).toMatchObject({
      quantity: "14",
      condition: "fair",
      notes: "Leaking",
    });
  });

  it("loads drafts saved before they existed", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [{ id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "12", unitLabel: "per_unit", installYear: "2016", usefulLife: "10", costEach: "1400", scenario: "run_to_failure" }],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows[0]).not.toHaveProperty("condition");
    expect(upgraded.rows[0]).not.toHaveProperty("notes");
    expect(toComponents(upgraded, 2026).components[0].installYearIsEstimate).toBe(false);
    expect(detailsSummary(upgraded.rows[0])).toBe("");
  });

  it("drops stored values the calculator couldn't have written", () => {
    const damaged = { ...row, condition: "excellent", notes: 42, installYearIsGuess: "yes" } as unknown as DraftRow;
    const cleaned = cleanDetails(damaged);
    expect(cleaned).not.toHaveProperty("condition");
    expect(cleaned).not.toHaveProperty("notes");
    expect(cleaned).not.toHaveProperty("installYearIsGuess");
    expect(cleaned.name).toBe(row.name);
    const upgraded = upgradeDraft({ unitCount: "12", yearBuilt: "", rows: [damaged] }, 2026);
    expect(upgraded.rows[0]).not.toHaveProperty("condition");
    // Good values, and no values, come back as they were.
    const good: DraftRow = { ...row, condition: null, notes: "", installYearIsGuess: false };
    expect(cleanDetails(good)).toBe(good);
    expect(cleanDetails(row)).toBe(row);
  });

  it("sums up what's behind More", () => {
    expect(detailsSummary({ condition: "fair", notes: "Leaking" })).toBe("Fair, notes");
    expect(detailsSummary({ condition: "poor", notes: "  " })).toBe("Poor");
    expect(detailsSummary({ condition: null, notes: "x" })).toBe("notes");
    expect(detailsSummary({})).toBe("");
  });

  it("counts down the last 200 characters of notes", () => {
    expect(notesLeftText("")).toBeNull();
    expect(notesLeftText("x".repeat(1799))).toBeNull();
    expect(notesLeftText("x".repeat(1800))).toBe("200 characters left");
    expect(notesLeftText("x".repeat(1999))).toBe("1 character left");
    expect(notesLeftText("x".repeat(2000))).toBe("0 characters left");
    expect(notesLeftText("x".repeat(2100))).toBe("0 characters left");
  });
});

describe("where the draft is kept", () => {
  it("is the key the loader reads to size its placeholder", () => {
    expect(STORAGE_KEY).toBe(DRAFT_STORAGE_KEY);
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

  it("fill a blank per-unit quantity from the unit count, as they did before", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [
        { id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "", unitLabel: "per_unit", installYear: "", usefulLife: "10", costEach: "", scenario: "run_to_failure" },
        { id: "b", librarySlug: null, category: "Flooring", name: "Carpet", quantity: "", unitLabel: "per_sq_ft", installYear: "", usefulLife: "8", costEach: "", scenario: "run_to_failure" },
      ],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows.map((r) => r.followsUnitCount)).toEqual([true, false]);
    expect(withUnitCount(upgraded, "14").rows.map((r) => r.quantity)).toEqual(["14", ""]);
  });

  it("leave rows that already have the flag as they are", () => {
    const blankOnPurpose: DraftRow = { ...rowFromLibrary(waterHeater, "12"), quantity: "", followsUnitCount: false };
    const upgraded = upgradeDraft({ unitCount: "12", yearBuilt: "", rows: [blankOnPurpose] }, 2026);
    expect(upgraded.rows[0].followsUnitCount).toBe(false);
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
  const windows = COMPONENT_LIBRARY.find((c) => c.slug === "vinyl-windows")!;

  it("appends a row that follows the unit count when no quantity or cost was typed", () => {
    const next = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [] }, waterHeater, { ...typed, costEach: "" }, "add");
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0]).toMatchObject({ librarySlug: "tank-water-heater", quantity: "12", followsUnitCount: true, installYear: "2016", costEach: "" });
    expect(next.forecastTracked).toBe(false);
  });

  // The page asks for a cost each: $650 a window must not become $650 an apartment.
  it("leaves the count blank when a cost each was typed without one", () => {
    const draft: Draft = { unitCount: "12", yearBuilt: "", rows: [] };
    const next = withLibraryItem(draft, windows, { installYear: "2005", quantity: "", costEach: "650" }, "add");
    const row = next.rows[0];
    expect(row).toMatchObject({ quantity: "", followsUnitCount: false, costEach: "650" });
    expect(costLabel(row)).toBe("Cost each");
    expect(rowTotal(row)).toBeNull();
    // The calculator asks for the count instead of guessing 12.
    const { components, problems } = toComponents(next, 2026);
    expect(components).toEqual([]);
    expect(problemFields(row, problems[row.id])).toEqual(["quantity"]);
    // And a new unit count doesn't fill it in either.
    expect(withUnitCount(next, "14").rows[0].quantity).toBe("");
  });

  it("uses the count typed with the cost", () => {
    const next = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [] }, windows, { installYear: "2005", quantity: "96", costEach: "650" }, "add");
    expect(rowTotal(next.rows[0])).toEqual({ quantity: 96, each: 650, total: 62400 });
  });

  it("keeps one of a building item when only a cost was typed", () => {
    const next = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [] }, roof, { installYear: "2008", quantity: "", costEach: "38000" }, "add");
    expect(next.rows[0]).toMatchObject({ quantity: "1", costEach: "38000" });
  });

  it("clears a following count when updating the cost each, but keeps one the owner set", () => {
    const following = rowFromLibrary(windows, "12");
    const typedCount = editRow(rowFromLibrary(windows, "12"), { quantity: "96" }, "12");
    const values = { installYear: "", quantity: "", costEach: "650" };
    const fromFollowing = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [following] }, windows, values, "update");
    expect(fromFollowing.rows[0]).toMatchObject({ quantity: "", followsUnitCount: false, costEach: "650" });
    const fromTyped = withLibraryItem({ unitCount: "12", yearBuilt: "", rows: [typedCount] }, windows, values, "update");
    expect(fromTyped.rows[0]).toMatchObject({ quantity: "96", followsUnitCount: false, costEach: "650" });
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
