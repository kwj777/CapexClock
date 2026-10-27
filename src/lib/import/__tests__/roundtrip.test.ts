import readExcelFile from "read-excel-file/universal";
import Papa from "papaparse";
import writeXlsxFile from "write-excel-file/universal";
import { componentListCsv, componentListGrid, EXAMPLE_BUILDING, exampleCsv, exampleGrid } from "@/lib/export/component-list";
import { listXlsx } from "@/lib/export/xlsx";
import {
  COMPONENT_LIBRARY,
  editRow,
  EMPTY_DRAFT,
  exampleDraft,
  withImport,
  withUnitCount,
  type Draft,
  type DraftRow,
} from "@/verticals/landlord";
import { CURRENT_YEAR, match, parse } from "../__fixtures__/sheets";
import { xlsxFile, type FixtureCell } from "../__fixtures__/xlsx";
import { openSheet, startingChoices } from "../open";
import { buildPreview, type Preview } from "../preview";
import { decodeText, readText } from "../read";
import { applyLabel, doneText, importSummary, knownRows, planImport, planSummary, sheetDetails, type ImportPlan } from "../reimport";
import type { Grid } from "../text";
import { readWorkbook } from "../xlsx";

/** The example list with every column in use: conditions, notes, guesses and a replace-now row. */
function owned(): Draft {
  const draft = exampleDraft();
  const rows = draft.rows.map((r, i): DraftRow => {
    if (i === 0) return { ...r, condition: "fair", notes: "Patched over unit 4, 2019.\nAsk Dana for the warranty.", installYearIsGuess: true };
    if (i === 1) return { ...r, condition: "poor", scenario: "replace_now", notes: "=SUM(A1) is not a formula" };
    if (i === 2) return { ...r, condition: "good", installYearIsGuess: false, notes: "Owner's note, with a comma" };
    return r;
  });
  return { ...draft, rows };
}

/** A downloaded component list, read back the way the import panel reads a chosen file. */
function gridFromCsv(csv: string): Grid {
  const grid = readText(decodeText(new TextEncoder().encode(csv)), parse, "file");
  if (typeof grid === "string") throw new Error(`readText failed: ${grid}`);
  return grid;
}

/** A downloaded Excel file, read back the way the import panel reads a chosen file. */
async function gridFromXlsx(blob: Blob): Promise<Grid> {
  const tabs = await readWorkbook(await blob.arrayBuffer(), readExcelFile);
  if (typeof tabs === "string") throw new Error(`readWorkbook failed: ${tabs}`);
  expect(tabs).toHaveLength(1);
  return tabs[0].grid;
}

function previewOf(grid: Grid, draft: Draft): Preview {
  const opened = openSheet(grid, match, CURRENT_YEAR);
  if (typeof opened === "string") throw new Error(`openSheet failed: ${opened}`);
  return buildPreview(opened.sheet, startingChoices(opened, CURRENT_YEAR), COMPONENT_LIBRARY, match, CURRENT_YEAR, knownRows(draft.rows));
}

/**
 * Imports as the panel does: the sheet's unit count and year built fill in blank ones,
 * and a different one is taken, as its choice is ticked to start with.
 */
function importInto(draft: Draft, grid: Grid, removeMissing = false): { plan: ImportPlan; next: Draft; preview: Preview } {
  const preview = previewOf(grid, draft);
  const plan = planImport(preview.rows, draft.rows);
  const details = sheetDetails(preview.buildings[0], draft);
  const taken = (field: "unitCount" | "yearBuilt") => [...details.fill, ...details.ask].find((d) => d.field === field)?.value;
  const next = withImport(draft, {
    add: plan.add,
    update: plan.update,
    remove: removeMissing ? plan.missing.map((m) => m.id) : [],
    unitCount: taken("unitCount"),
    yearBuilt: taken("yearBuilt"),
  });
  return { plan, next, preview };
}

/** The file with every Units cell changed to `units`. */
function withUnits(csv: string, units: string): string[][] {
  const table = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," }).data;
  const col = table[0].indexOf("Units");
  return table.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === col ? units : c))));
}

/** The per-unit rows' names, quantities and whether they follow the unit count. */
function perUnit(draft: Draft): [string, string, boolean | undefined][] {
  return draft.rows.filter((r) => r.unitLabel === "per_unit").map((r) => [r.name, r.quantity, r.followsUnitCount]);
}

/** What the owner sees of a row: everything but its id and the unit-count follow flag. */
function shown(r: DraftRow) {
  return {
    librarySlug: r.librarySlug,
    category: r.category,
    name: r.name,
    quantity: r.quantity,
    unitLabel: r.unitLabel,
    installYear: r.installYear,
    usefulLife: r.usefulLife,
    costEach: r.costEach,
    scenario: r.scenario,
    condition: r.condition ?? null,
    notes: r.notes ?? "",
    installYearIsGuess: r.installYearIsGuess === true,
  };
}

const building = { name: "Maple Court", unitCount: "12", yearBuilt: "1998" };

describe("downloading the component list and importing it again", () => {
  const draft = owned();
  const csv = componentListCsv(building, draft.rows);

  it("reads every row as Ready, matched to its row by CapexClock ID", () => {
    const preview = previewOf(gridFromCsv(csv), draft);
    expect(preview.counts).toMatchObject({ rows: draft.rows.length, ready: draft.rows.length, needsYou: 0, skipped: 0 });
    expect(preview.idColumn).toBe(true);
    expect(preview.quantityQuestion).toBeNull();
    expect(preview.rows.map((r) => r.capexclockId)).toEqual(draft.rows.map((r) => r.id));
  });

  it("gives back the same rows, with condition, notes and the guess flag, and changes nothing", () => {
    const { plan, next } = importInto(draft, gridFromCsv(csv));
    expect(plan.matched).toBe(true);
    expect(plan.add).toEqual([]);
    expect(plan.missing).toEqual([]);
    expect(plan.update.every((u) => u.changes.length === 0)).toBe(true);
    expect(applyLabel(plan, false)).toBeNull();
    expect(doneText(plan, 0)).toBe("Your list already matched the spreadsheet.");
    expect(next.rows.map((r) => r.id)).toEqual(draft.rows.map((r) => r.id));
    expect(next.rows.map(shown)).toEqual(draft.rows.map(shown));
  });

  it("fills an empty list with the same rows, under new ids, and the building's details", () => {
    const grid = gridFromCsv(csv);
    const preview = previewOf(grid, EMPTY_DRAFT);
    const { plan, next } = importInto(EMPTY_DRAFT, grid);
    expect(plan.matched).toBe(false);
    expect(plan.unknownIds).toBe(draft.rows.length);
    expect(planSummary(plan)[0]).toMatch(/^None of the CapexClock IDs in this file are in this list/);
    expect(applyLabel(plan, false)).toBe(`Add ${draft.rows.length} rows`);
    expect(next.rows.map(shown)).toEqual(draft.rows.map(shown));
    expect(next.rows.some((r) => draft.rows.some((d) => d.id === r.id))).toBe(false);
    expect(sheetDetails(preview.buildings[0], EMPTY_DRAFT).fill).toEqual([
      { field: "unitCount", value: "12", current: "" },
      { field: "yearBuilt", value: "1998", current: "" },
    ]);
  });

  it("changes one row when one install year changes, keeping the count the same", () => {
    const table = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," }).data;
    const year = table[0].indexOf("Install year");
    const edited = table.map((r, i) => (i === 2 ? r.map((c, j) => (j === year ? String(Number(c) + 2) : c)) : r));
    const { plan, next } = importInto(draft, edited);
    expect(next.rows).toHaveLength(draft.rows.length);
    expect(plan.add).toEqual([]);
    expect(plan.update.filter((u) => u.changes.length > 0)).toEqual([
      expect.objectContaining({
        id: draft.rows[1].id,
        changes: [`Install year from ${draft.rows[1].installYear} to ${Number(draft.rows[1].installYear) + 2}`],
      }),
    ]);
    expect(applyLabel(plan, false)).toBe("Update 1 row");
    expect(planSummary(plan)[0]).toBe(`Matched ${draft.rows.length} rows of your list by CapexClock ID: 1 to update and ${draft.rows.length - 1} the same.`);
    expect(next.rows[1]).toMatchObject({ id: draft.rows[1].id, installYear: String(Number(draft.rows[1].installYear) + 2) });
    expect(next.rows.filter((r, i) => shown(r).installYear !== shown(draft.rows[i]).installYear)).toHaveLength(1);
  });

  it("adds rows without an ID, and removes rows missing from the file only when the owner says so", () => {
    const table = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," }).data;
    const id = table[0].indexOf("CapexClock ID");
    const newRow = table[1].map((c, j) => (j === id ? "" : j === 3 ? "Boiler" : c));
    const edited = [table[0], ...table.slice(2), newRow];
    const kept = importInto(draft, edited);
    expect(kept.plan.add.map((r) => r.name)).toEqual(["Boiler"]);
    expect(kept.plan.missing).toEqual([{ id: draft.rows[0].id, name: draft.rows[0].name, installYear: draft.rows[0].installYear }]);
    expect(applyLabel(kept.plan, false)).toBe("Add 1 row");
    expect(kept.next.rows).toHaveLength(draft.rows.length + 1);

    const removed = importInto(draft, edited, true);
    expect(applyLabel(removed.plan, true)).toBe("Add 1 row and remove 1");
    expect(doneText(removed.plan, 1)).toBe("Added 1 row and removed 1 from your spreadsheet.");
    expect(removed.next.rows).toHaveLength(draft.rows.length);
    expect(removed.next.rows.some((r) => r.id === draft.rows[0].id)).toBe(false);
  });

  it("reads the same rows back from the file saved as .xlsx in Excel", async () => {
    // Excel turns numbers in a CSV into numbers when it opens it, and keeps the rest as text.
    const table = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," }).data;
    const cells: FixtureCell[][] = table.map((r, i) => r.map((c) => (i > 0 && /^\d+(\.\d+)?$/.test(c) ? Number(c) : c)));
    const tabs = await readWorkbook(xlsxFile([{ name: "Component list", rows: cells }]), readExcelFile);
    if (typeof tabs === "string") throw new Error(tabs);
    const { plan, next } = importInto(draft, tabs[0].grid);
    expect(plan.update.every((u) => u.changes.length === 0)).toBe(true);
    expect(next.rows.map(shown)).toEqual(draft.rows.map(shown));
  });

  it("gives back the same rows from the Excel download, and changes nothing", async () => {
    const grid = await gridFromXlsx(await listXlsx(componentListGrid(building, draft.rows), writeXlsxFile));
    const preview = previewOf(grid, draft);
    expect(preview.counts).toMatchObject({ rows: draft.rows.length, ready: draft.rows.length, needsYou: 0, skipped: 0 });
    const { plan, next } = importInto(draft, grid);
    expect(plan.matched).toBe(true);
    expect(plan.add).toEqual([]);
    expect(plan.missing).toEqual([]);
    expect(plan.update.every((u) => u.changes.length === 0)).toBe(true);
    expect(next.rows.map((r) => r.id)).toEqual(draft.rows.map((r) => r.id));
    expect(next.rows.map(shown)).toEqual(draft.rows.map(shown));
    expect(perUnit(next)).toEqual(perUnit(draft));
  });

  it("leaves Quantity blank on rows that follow the unit count, and writes the rest", () => {
    const table = Papa.parse<string[]>(csv.slice(1).trimEnd(), { delimiter: "," }).data;
    const [name, quantity] = ["Component", "Quantity"].map((h) => table[0].indexOf(h));
    const written = new Map(table.slice(1).map((r) => [r[name], r[quantity]]));
    for (const r of draft.rows) {
      expect([r.name, written.get(r.name)]).toEqual([r.name, r.unitLabel === "per_unit" && r.followsUnitCount ? "" : r.quantity]);
    }
    expect(perUnit(draft).every(([, , follows]) => follows)).toBe(true);
  });

  it("moves the rows that follow the unit count when the Units column changes, as the app does", () => {
    const { plan, next, preview } = importInto(draft, withUnits(csv, "14"));
    expect(preview.counts).toMatchObject({ ready: draft.rows.length, changed: 0, needsYou: 0 });
    // Nothing about the rows changes: they still follow the unit count, which is now 14.
    expect(plan.update.every((u) => u.changes.length === 0)).toBe(true);
    const details = sheetDetails(preview.buildings[0], draft);
    expect(importSummary(preview.counts, plan, false, details.ask)).toBe(
      `${draft.rows.length} rows: ${draft.rows.length} the same. ${draft.rows.length} ready. Rental units will be set to 14.`,
    );
    expect(next.unitCount).toBe("14");
    expect(perUnit(next)).toEqual(perUnit(draft).map(([n]) => [n, "14", true]));
    // And they keep following it afterwards.
    expect(perUnit(withUnitCount(next, "16"))).toEqual(perUnit(draft).map(([n]) => [n, "16", true]));
    // Everything else is as it was.
    const others = (d: Draft) => d.rows.filter((r) => r.unitLabel !== "per_unit").map(shown);
    expect(others(next)).toEqual(others(draft));
  });

  it("keeps a count the owner typed", () => {
    const typed = { ...draft, rows: draft.rows.map((r) => (r.unitLabel === "per_unit" ? editRow(r, { quantity: "10" }, "12") : r)) };
    const file = componentListCsv(building, typed.rows);
    const { next } = importInto(typed, withUnits(file, "14"));
    expect(perUnit(next)).toEqual(perUnit(typed).map(([n]) => [n, "10", false]));
  });

  it("moves a typed count that is the unit count, which keeps the row following it", () => {
    const typed = { ...draft, rows: draft.rows.map((r) => (r.unitLabel === "per_unit" ? editRow(r, { quantity: "12" }, "12") : r)) };
    expect(perUnit(typed).every(([, , follows]) => follows)).toBe(true);
    const { next } = importInto(typed, withUnits(componentListCsv(building, typed.rows), "14"));
    expect(perUnit(next)).toEqual(perUnit(typed).map(([n]) => [n, "14", true]));
  });
});

describe("the filled-in example", () => {
  it("leaves Quantity blank on its rows counted per unit", () => {
    const table = Papa.parse<string[]>(exampleCsv().slice(1).trimEnd(), { delimiter: "," }).data;
    const [counted, quantity] = ["Counted per", "Quantity"].map((h) => table[0].indexOf(h));
    const body = table.slice(1);
    expect(body.filter((r) => r[counted] === "unit").map((r) => r[quantity])).toEqual(["", "", ""]);
    expect(body.filter((r) => r[counted] !== "unit").every((r) => r[quantity] !== "")).toBe(true);
  });

  it("counts one of each per-unit item in every unit when the Units column is changed", () => {
    const { next, preview } = importInto(EMPTY_DRAFT, withUnits(exampleCsv(), "20"));
    expect(preview.counts).toMatchObject({ ready: exampleDraft().rows.length, needsYou: 0 });
    expect(next.unitCount).toBe("20");
    expect(perUnit(next)).toEqual([
      ["Gas furnace", "20", true],
      ["Tank water heater", "20", true],
      ["Refrigerator", "20", true],
    ]);
  });

  it("imports as the calculator's example from the Excel file too", async () => {
    const grid = await gridFromXlsx(await listXlsx(exampleGrid(), writeXlsxFile));
    expect(previewOf(grid, EMPTY_DRAFT).counts).toMatchObject({ ready: exampleDraft().rows.length, needsYou: 0 });
    const csv = importInto(EMPTY_DRAFT, gridFromCsv(exampleCsv())).next;
    const { next } = importInto(EMPTY_DRAFT, grid);
    expect(next.rows.map(shown)).toEqual(csv.rows.map(shown));
    expect(next.rows.map((r) => r.followsUnitCount)).toEqual(csv.rows.map((r) => r.followsUnitCount));
    expect([next.unitCount, next.yearBuilt]).toEqual([csv.unitCount, csv.yearBuilt]);
  });

  it("imports as the calculator's example, every row Ready", () => {
    const grid = gridFromCsv(exampleCsv());
    const preview = previewOf(grid, EMPTY_DRAFT);
    expect(preview.counts.needsYou).toBe(0);
    expect(preview.counts.ready).toBe(exampleDraft().rows.length);
    expect(preview.buildings).toEqual([
      expect.objectContaining({ name: EXAMPLE_BUILDING.name, unitCount: 12, yearBuilt: 1998, notes: [] }),
    ]);
    const { next } = importInto(EMPTY_DRAFT, grid);
    expect(next.rows.map((r) => r.name)).toEqual(exampleDraft().rows.map((r) => r.name));
    expect(next.rows.map((r) => [r.quantity, r.followsUnitCount])).toEqual(
      exampleDraft().rows.map((r) => [r.quantity, r.followsUnitCount]),
    );
  });
});
