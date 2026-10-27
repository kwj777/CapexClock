import { COMPONENT_LIBRARY } from "../../library/components";
import { problemFields, toComponents } from "../components";
import { exampleDraft } from "../example";
import { EMPTY_DRAFT, type Draft, type DraftRow } from "../model";
import {
  costLabel,
  customRow,
  editRow,
  hasEntries,
  neighborRowId,
  parseUnitCount,
  rowFromLibrary,
  rowTotal,
  withLibraryItem,
  withUnitCount,
} from "../rows";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const washer = COMPONENT_LIBRARY.find((c) => c.slug === "washer-dryer")!;
const roof = COMPONENT_LIBRARY.find((c) => c.slug === "asphalt-shingle-roof")!;
const carpet = COMPONENT_LIBRARY.find((c) => c.slug === "carpet")!;

/** Types a unit count one keystroke at a time, the way the input's onChange sees it. */
function typeUnitCount(draft: Draft, ...values: string[]): Draft {
  return values.reduce(withUnitCount, draft);
}

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

  it("counts a property name too, but not a blank one", () => {
    expect(hasEntries({ ...EMPTY_DRAFT, name: "14 Maple Court" })).toBe(true);
    expect(hasEntries({ ...EMPTY_DRAFT, name: "  " })).toBe(false);
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

  it("keeps a row following the unit count when the owner types the unit count itself, as a reload does", () => {
    const typed = editRow(rowFromLibrary(waterHeater, "12"), { quantity: "6" }, "12");
    const back = editRow(typed, { quantity: "12" }, "12");
    expect(back.followsUnitCount).toBe(true);
    expect(costLabel(back)).toBe("Cost per apartment");
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [back] }, "14").rows[0].quantity).toBe("14");
    // Not a per-building row, and not while there's no unit count.
    expect(editRow(rowFromLibrary(roof, "12"), { quantity: "12" }, "12").followsUnitCount).toBe(false);
    expect(editRow(rowFromLibrary(waterHeater, ""), { quantity: "" }, "").followsUnitCount).toBe(false);
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
