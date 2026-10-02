import type { DraftRow } from "@/components/calculator/draft";
import type { ImportedRow, PreviewRow } from "../preview";
import {
  applyLabel,
  askText,
  doneText,
  fillText,
  importSummary,
  listNote,
  listNotes,
  listsMissing,
  planImport,
  planSummary,
  removeText,
  rowChanges,
  sheetDetails,
} from "../reimport";

const listRow = (id: string, over: Partial<DraftRow> = {}): DraftRow => ({
  id,
  librarySlug: "tank-water-heater",
  category: "Plumbing",
  name: "Tank water heater",
  quantity: "12",
  unitLabel: "per_unit",
  installYear: "2016",
  usefulLife: "10",
  costEach: "1400",
  scenario: "run_to_failure",
  ...over,
});

const sheetRow = (over: Partial<ImportedRow> = {}): ImportedRow => ({
  librarySlug: "tank-water-heater",
  category: "Plumbing",
  name: "Tank water heater",
  quantity: "12",
  unitLabel: "per_unit",
  installYear: "2016",
  installYearIsGuess: false,
  usefulLife: "10",
  costEach: "1400",
  condition: null,
  notes: "",
  replaceNow: false,
  ...over,
});

let next = 0;
const previewRow = (capexclockId: string | null, row: ImportedRow = sheetRow()): PreviewRow => {
  next += 1;
  return {
    id: `p${next}`,
    keys: [`p${next}`],
    sheetRows: [next + 1],
    status: "ready",
    row,
    changes: [],
    issues: [],
    question: null,
    lifeIsTypical: false,
    building: "",
    capexclockId,
  };
};

describe("what a row from the file changes", () => {
  it("says each difference in the owner's words", () => {
    const current = listRow("a", { condition: "good", notes: "Old", installYearIsGuess: true });
    const changes = rowChanges(
      current,
      sheetRow({
        name: "Water heater (gas)",
        quantity: "10",
        unitLabel: "per_building",
        installYear: "2018",
        usefulLife: "12",
        costEach: "1500",
        condition: "poor",
        notes: "",
        replaceNow: true,
      }),
    );
    expect(changes).toEqual([
      'Name from "Tank water heater" to "Water heater (gas)"',
      "Quantity from 12 to 10",
      "Counted per from unit to building",
      "Install year from 2016 to 2018",
      "Install year no longer marked a guess",
      "Useful life from 10 to 12",
      "Cost each from $1,400 to $1,500",
      "Condition from Good to Poor",
      "Notes cleared",
      "Planned to replace this year",
    ]);
  });

  it("treats the same number written two ways as the same", () => {
    expect(rowChanges(listRow("a", { costEach: "$1,400", quantity: "12.0" }), sheetRow())).toEqual([]);
    // A row that takes the unit count changes only a row that doesn't already.
    const takesUnits = sheetRow({ quantity: "", followsUnitCount: true });
    expect(rowChanges(listRow("a", { followsUnitCount: true, quantity: "8" }), takesUnits)).toEqual([]);
    expect(rowChanges(listRow("a", { followsUnitCount: false, quantity: "3" }), takesUnits)).toEqual(["Quantity from 3 to the unit count"]);
  });
});

describe("planning an import against the list", () => {
  const list = [listRow("a"), listRow("b", { name: "Furnace" }), listRow("c", { name: "Carpet" })];

  it("only adds when nothing matches, and never offers to remove", () => {
    const plan = planImport([previewRow(null), previewRow("zzz")], list);
    expect(plan.matched).toBe(false);
    expect(plan.add).toHaveLength(2);
    expect(plan.unknownIds).toBe(1);
    expect(plan.missing).toEqual([]);
    expect(applyLabel(plan, true)).toBe("Add 2 rows");
    expect(doneText(plan, 0)).toBe("Added 2 rows from your spreadsheet.");
    expect(listNotes(plan).size).toBe(0);
  });

  it("updates the first row with an ID and adds a copied row as new", () => {
    const first = previewRow("a", sheetRow({ installYear: "2019" }));
    const copy = previewRow("a");
    const fresh = previewRow(null, sheetRow({ name: "Boiler" }));
    const plan = planImport([first, copy, fresh], list);
    expect(plan.update).toEqual([{ id: "a", row: first.row, changes: ["Install year from 2016 to 2019"] }]);
    expect(plan.add.map((r) => r.name)).toEqual(["Tank water heater", "Boiler"]);
    expect(plan.repeatedIds).toBe(1);
    expect(plan.missing).toEqual([
      { id: "b", name: "Furnace" },
      { id: "c", name: "Carpet" },
    ]);
    expect(planSummary(plan)).toEqual([
      "Matched 1 row of your list by CapexClock ID: 1 to update.",
      "2 new rows to add.",
      "1 row has a CapexClock ID that isn't in your list or is on another row too, so it's added as new.",
      "2 rows in your list aren't in this file.",
    ]);
    expect(applyLabel(plan, false)).toBe("Update 1 row and add 2");
    expect(applyLabel(plan, true)).toBe("Update 1 row, add 2 and remove 2");
    expect(doneText(plan, 2)).toBe("Updated 1 row, added 2 and removed 2 from your spreadsheet.");
    expect(listNote(plan, first.id)).toBe("Changes your list: Install year from 2016 to 2019.");
    expect(listNote(plan, fresh.id)).toBe("New: added to your list.");
  });

  it("sums up what a component list download does, for the preview and the live region", () => {
    const counts = (rows: number, more: Partial<{ ready: number; changed: number; needsYou: number; skipped: number }> = {}) => ({
      rows,
      ready: rows,
      changed: 0,
      needsYou: 0,
      skipped: 0,
      otherBuildings: 0,
      ...more,
    });
    // One install year changed in a list of three: nothing is added.
    const one = planImport(
      [previewRow("a", sheetRow({ installYear: "2019" })), previewRow("b", sheetRow({ name: "Furnace" })), previewRow("c", sheetRow({ name: "Carpet" }))],
      list,
    );
    expect(importSummary(counts(3), one, false)).toBe("3 rows: 1 to update and 2 the same. 3 ready.");
    expect(applyLabel(one, false)).toBe("Update 1 row");

    const mixed = planImport([previewRow("a", sheetRow({ installYear: "2019" })), previewRow(null, sheetRow({ name: "Boiler" }))], list);
    expect(importSummary(counts(2, { ready: 1, needsYou: 1, skipped: 1 }), mixed, false)).toBe(
      "2 rows: 1 to update and 1 to add. 1 ready, 1 needs you. 2 rows in your list aren't in this file and will stay. 1 row skipped.",
    );
    expect(importSummary(counts(2, { ready: 1, needsYou: 1 }), mixed, true)).toBe(
      "2 rows: 1 to update and 1 to add. 1 ready, 1 needs you. 2 rows in your list aren't in this file and will be removed.",
    );

    const same = planImport([previewRow("a"), previewRow("b", sheetRow({ name: "Furnace" })), previewRow("c", sheetRow({ name: "Carpet" }))], list);
    expect(importSummary(counts(3), same, false)).toBe("3 rows: 3 the same. 3 ready.");

    // A file without IDs only adds, as before.
    const fresh = planImport([previewRow(null)], list);
    expect(importSummary(counts(1, { skipped: 2 }), fresh, false)).toBe("1 row to add: 1 ready. 2 rows skipped.");
  });

  it("can only remove when that's all there is to do", () => {
    const plan = planImport([previewRow("a")], list);
    expect(applyLabel(plan, false)).toBeNull();
    expect(applyLabel(plan, true)).toBe("Remove 2 rows");
    expect(listNote(plan, `p${next}`)).toBeNull();
  });

  it("names the rows it would remove, or points to the list of them all", () => {
    expect(removeText([{ name: "Boiler" }])).toBe("Remove Boiler from my list");
    const four = ["A", "B", "C", "D"].map((name) => ({ name }));
    expect(removeText(four)).toBe("Remove A, B, C and D from my list");
    expect(listsMissing(four)).toBe(false);
    // Past four, every row is listed above the choice, so none is removed unseen.
    const ten = "ABCDEFGHIJ".split("").map((name) => ({ name }));
    expect(removeText(ten)).toBe("Remove these 10 rows from my list");
    expect(listsMissing(ten)).toBe(true);
  });
});

describe("the building's details from the sheet", () => {
  it("fills in blank ones and asks about different ones", () => {
    const details = sheetDetails({ unitCount: 12, yearBuilt: 1998 }, { unitCount: "14", yearBuilt: "" });
    expect(details.fill).toEqual([{ field: "yearBuilt", value: "1998", current: "" }]);
    expect(details.ask).toEqual([{ field: "unitCount", value: "12", current: "14" }]);
    expect(fillText(details.fill)).toBe("Year built will come from the sheet: built 1998.");
    expect(askText(details.ask[0])).toBe("Change rental units from 14 to 12");
  });

  it("says nothing when they match or the sheet doesn't give them", () => {
    expect(sheetDetails({ unitCount: 12, yearBuilt: null }, { unitCount: "12", yearBuilt: "2001" })).toEqual({ fill: [], ask: [] });
    expect(sheetDetails(undefined, { unitCount: "", yearBuilt: "" })).toEqual({ fill: [], ask: [] });
    expect(fillText([])).toBe("");
  });

  it("says both when both are filled in", () => {
    const { fill } = sheetDetails({ unitCount: 1, yearBuilt: 1998 }, { unitCount: "", yearBuilt: "" });
    expect(fillText(fill)).toBe("Rental units and year built will come from the sheet: 1 unit and built 1998.");
  });
});
