import { exampleDraft } from "../example";
import { importReplaces, importUndoFor, withImport, withImportedRows, type ImportedRow } from "../import";
import { EMPTY_DRAFT, type DraftRow } from "../model";
import { withUnitCount } from "../rows";

describe("adding rows from a spreadsheet", () => {
  const imported = (quantity: string, unitLabel: DraftRow["unitLabel"] = "per_unit") => ({
    librarySlug: "tank-water-heater",
    category: "Plumbing",
    name: "Tank water heater",
    quantity,
    unitLabel,
    installYear: "2014",
    installYearIsGuess: true,
    usefulLife: "10",
    costEach: "1400",
    condition: "fair" as const,
    notes: "Apt: 101 and 102",
    replaceNow: false,
  });

  it("adds after the rows already there and never replaces them", () => {
    const draft = { ...exampleDraft(), forecastTracked: true };
    const next = withImportedRows(draft, [imported("12"), imported("2")]);
    expect(next.rows).toHaveLength(draft.rows.length + 2);
    expect(next.rows.slice(0, draft.rows.length)).toEqual(draft.rows);
    expect(next.rows.at(-1)).toMatchObject({
      quantity: "2",
      installYear: "2014",
      installYearIsGuess: true,
      condition: "fair",
      notes: "Apt: 101 and 102",
      scenario: "run_to_failure",
    });
    expect(new Set(next.rows.map((r) => r.id)).size).toBe(next.rows.length);
    expect(next.forecastTracked).toBe(true);
  });

  it("keeps quantities as given: a per-unit row follows the unit count only when it equals it", () => {
    const next = withImportedRows({ unitCount: "12", yearBuilt: "", rows: [] }, [imported("12"), imported("10"), imported("12", "per_building")]);
    expect(next.rows.map((r) => r.followsUnitCount)).toEqual([true, false, false]);
    const grown = withUnitCount(next, "14");
    expect(grown.rows.map((r) => r.quantity)).toEqual(["14", "10", "12"]);
  });

  it("starts a new forecast when the draft was empty", () => {
    const next = withImportedRows({ ...EMPTY_DRAFT, forecastTracked: true }, [imported("1")]);
    expect(next.forecastTracked).toBe(false);
  });
});

describe("importing a component list download", () => {
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
    condition: "good",
    notes: "",
    replaceNow: false,
    ...over,
  });

  it("changes matched rows in place, keeping their ids and order, then adds new rows after", () => {
    const draft = exampleDraft();
    const [first, second] = draft.rows;
    const next = withImport(draft, {
      add: [sheetRow({ name: "Boiler", librarySlug: null, category: "HVAC" })],
      update: [{ id: second.id, row: sheetRow({ installYear: "2020", replaceNow: true, notes: "New quote" }) }],
      remove: [],
    });
    expect(next.rows).toHaveLength(draft.rows.length + 1);
    expect(next.rows[0]).toEqual(first);
    expect(next.rows[1]).toMatchObject({
      id: second.id,
      installYear: "2020",
      scenario: "replace_now",
      notes: "New quote",
      condition: "good",
      followsUnitCount: true,
    });
    expect(next.rows.at(-1)).toMatchObject({ name: "Boiler", category: "HVAC" });
  });

  it("removes only the rows the owner chose", () => {
    const draft = exampleDraft();
    const gone = draft.rows[2].id;
    const next = withImport(draft, { add: [], update: [], remove: [gone] });
    expect(next.rows.map((r) => r.id)).toEqual(draft.rows.filter((r) => r.id !== gone).map((r) => r.id));
  });

  it("takes the building's unit count and year built first, so per-unit rows follow the new count", () => {
    const draft = exampleDraft();
    const next = withImport(draft, { add: [sheetRow({ quantity: "14" })], update: [], remove: [], unitCount: "14", yearBuilt: "2001" });
    expect(next.unitCount).toBe("14");
    expect(next.yearBuilt).toBe("2001");
    expect(next.rows.at(-1)?.followsUnitCount).toBe(true);
    const followed = draft.rows.filter((r) => r.followsUnitCount).map((r) => r.id);
    expect(followed.length).toBeGreaterThan(0);
    for (const id of followed) expect(next.rows.find((r) => r.id === id)?.quantity).toBe("14");
  });
});

describe("undoing an import from the template page", () => {
  const draft = exampleDraft();
  const gone = draft.rows[0].id;
  const after = withImport(draft, { add: [], update: [], remove: [gone] });
  // As kept in storage and read back.
  const kept = JSON.parse(JSON.stringify({ before: draft, after })) as unknown;

  it("is kept only for an import that changes or removes rows, or the building's details", () => {
    expect(importReplaces({ add: [], update: [], remove: [gone] })).toBe(true);
    expect(importReplaces({ add: [], update: [{ id: gone, row: {} as ImportedRow }], remove: [] })).toBe(true);
    expect(importReplaces({ add: [], update: [], remove: [], unitCount: "14" })).toBe(true);
    expect(importReplaces({ add: [{} as ImportedRow], update: [], remove: [] })).toBe(false);
  });

  it("brings back the list as it was while the list is what the import left", () => {
    const back = importUndoFor(kept, after, 2026);
    expect(back?.rows.map((r) => r.id)).toEqual(draft.rows.map((r) => r.id));
    expect(back?.unitCount).toBe(draft.unitCount);
  });

  it("isn't offered once the list has changed since, or for a damaged copy", () => {
    expect(importUndoFor(kept, withUnitCount(after, "20"), 2026)).toBeNull();
    expect(importUndoFor(kept, draft, 2026)).toBeNull();
    expect(importUndoFor({ before: "x", after }, after, 2026)).toBeNull();
    expect(importUndoFor(null, after, 2026)).toBeNull();
  });
});
