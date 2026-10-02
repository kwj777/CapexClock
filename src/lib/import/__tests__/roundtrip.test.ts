import readExcelFile from "read-excel-file/universal";
import Papa from "papaparse";
import { EMPTY_DRAFT, exampleDraft, withImport, type Draft, type DraftRow } from "@/components/calculator/draft";
import { componentListCsv, EXAMPLE_BUILDING, exampleCsv } from "@/lib/export/component-list";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import { CURRENT_YEAR, match, parse } from "../__fixtures__/sheets";
import { xlsxFile, type FixtureCell } from "../__fixtures__/xlsx";
import { openSheet, startingChoices } from "../open";
import { buildPreview, type Preview } from "../preview";
import { decodeText, readText } from "../read";
import { applyLabel, doneText, knownRows, planImport, planSummary, sheetDetails, type ImportPlan } from "../reimport";
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

function previewOf(grid: Grid, draft: Draft): Preview {
  const opened = openSheet(grid, match, CURRENT_YEAR);
  if (typeof opened === "string") throw new Error(`openSheet failed: ${opened}`);
  return buildPreview(opened.sheet, startingChoices(opened, CURRENT_YEAR), COMPONENT_LIBRARY, match, CURRENT_YEAR, knownRows(draft.rows));
}

function importInto(draft: Draft, grid: Grid, removeMissing = false): { plan: ImportPlan; next: Draft; preview: Preview } {
  const preview = previewOf(grid, draft);
  const plan = planImport(preview.rows, draft.rows);
  const next = withImport(draft, {
    add: plan.add,
    update: plan.update,
    remove: removeMissing ? plan.missing.map((m) => m.id) : [],
  });
  return { plan, next, preview };
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
    expect(preview.unitsQuestion).toBeNull();
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
    expect(planSummary(plan)[0]).toBe(`Matched ${draft.rows.length} rows of your list by CapexClock ID: 1 changed and ${draft.rows.length - 1} the same.`);
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
    expect(kept.plan.missing).toEqual([{ id: draft.rows[0].id, name: draft.rows[0].name }]);
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
});

describe("the filled-in example", () => {
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
  });
});
