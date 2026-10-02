import { CONDITION_TEXT, type DraftRow } from "@/components/calculator/draft";
import { formatUnitPrice } from "@/components/calculator/format";
import { COUNTED_PER_TEXT } from "./format";
import type { BuildingInfo, ImportedRow, KnownRow, Preview, PreviewRow } from "./preview";
import { listText, quote } from "./text";
import { previewSummary, skippedText, statusText } from "./wording";

/**
 * What an import does to the list. A file without CapexClock IDs only adds rows.
 * A component list download updates the rows its IDs match instead of adding them
 * again, and can remove the rows it no longer has, once the owner says so.
 */
export interface ImportPlan {
  /** New rows, added after the list's own. */
  add: ImportedRow[];
  /** Rows of the list the file has, by id, with what's different ([] when nothing is). */
  update: { id: string; row: ImportedRow; changes: string[] }[];
  /** Rows of the list the file doesn't have. They stay unless the owner removes them. */
  missing: { id: string; name: string; installYear: string }[];
  /** The file matched rows of the list by CapexClock ID. */
  matched: boolean;
  /** Rows whose CapexClock ID isn't in the list, so they're added as new. */
  unknownIds: number;
  /** Rows whose CapexClock ID an earlier row already has (a copied row), so they're added as new. */
  repeatedIds: number;
  /** Preview row ids, for the preview to say what each one does. */
  byPreviewRow: Map<string, { kind: "add" } | { kind: "update"; changes: string[] }>;
}

/** The list's rows by id, for reading a component list download against them. */
export function knownRows(rows: readonly Pick<DraftRow, "id" | "name" | "librarySlug" | "category">[]): Map<string, KnownRow> {
  return new Map(rows.map((r) => [r.id, { name: r.name, librarySlug: r.librarySlug, category: r.category }]));
}

/** A number as the calculator reads it, so "1,400" and "1400" are the same. */
function asNumber(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function sameNumber(a: string, b: string): boolean {
  const [x, y] = [asNumber(a), asNumber(b)];
  return x !== null && y !== null ? x === y : a.trim() === b.trim();
}

function shown(text: string): string {
  return text.trim() === "" ? "blank" : text.trim();
}

function money(text: string): string {
  const n = asNumber(text);
  return n === null ? shown(text) : formatUnitPrice(n);
}

/** What importing `row` would change in `current`, in the owner's words. Empty when nothing. */
export function rowChanges(current: DraftRow, row: ImportedRow): string[] {
  const changes: string[] = [];
  const from = (what: string, a: string, b: string) => changes.push(`${what} from ${a} to ${b}`);
  if (current.name.trim() !== row.name.trim()) from("Name", quote(current.name.trim()), quote(row.name.trim()));
  else if ((current.librarySlug ?? null) !== row.librarySlug) changes.push(`Matched to a different item in our list`);
  if (current.category !== row.category) from("Category", shown(current.category), shown(row.category));
  if (row.followsUnitCount && row.unitLabel === "per_unit") {
    // It takes the list's unit count, so only a row that doesn't already is changed.
    const follows = current.unitLabel === "per_unit" && current.followsUnitCount === true;
    if (!follows) from("Quantity", shown(current.quantity), "the unit count");
  } else if (!sameNumber(current.quantity, row.quantity)) from("Quantity", shown(current.quantity), shown(row.quantity));
  if (current.unitLabel !== row.unitLabel) {
    from("Counted per", COUNTED_PER_TEXT[current.unitLabel], COUNTED_PER_TEXT[row.unitLabel]);
  }
  if (current.installYear.trim() !== row.installYear.trim()) from("Install year", shown(current.installYear), shown(row.installYear));
  if ((current.installYearIsGuess === true) !== row.installYearIsGuess) {
    changes.push(row.installYearIsGuess ? "Install year marked a guess" : "Install year no longer marked a guess");
  }
  if (!sameNumber(current.usefulLife, row.usefulLife)) from("Useful life", shown(current.usefulLife), shown(row.usefulLife));
  if (!sameNumber(current.costEach, row.costEach)) from("Cost each", money(current.costEach), money(row.costEach));
  const condition = current.condition ?? null;
  if (condition !== row.condition) {
    from("Condition", condition ? CONDITION_TEXT[condition] : "not set", row.condition ? CONDITION_TEXT[row.condition] : "not set");
  }
  if (((current.notes ?? "").trim()) !== row.notes.trim()) changes.push(row.notes.trim() === "" ? "Notes cleared" : "Notes changed");
  if ((current.scenario === "replace_now") !== row.replaceNow) {
    changes.push(row.replaceNow ? "Planned to replace this year" : "No longer planned to replace this year");
  }
  return changes;
}

/**
 * Reads the preview's rows against the list. Rows whose CapexClock ID is in the
 * list update that row; the rest are added. Only a file that matched some row by
 * ID can remove rows, so a file meant for another list never offers to.
 */
export function planImport(rows: readonly PreviewRow[], list: readonly DraftRow[]): ImportPlan {
  const byId = new Map(list.map((r) => [r.id, r]));
  const used = new Set<string>();
  const plan: ImportPlan = {
    add: [],
    update: [],
    missing: [],
    matched: false,
    unknownIds: 0,
    repeatedIds: 0,
    byPreviewRow: new Map(),
  };
  for (const r of rows) {
    const id = r.capexclockId;
    const current = id === null ? undefined : byId.get(id);
    if (id !== null && current && !used.has(id)) {
      used.add(id);
      const changes = rowChanges(current, r.row);
      plan.update.push({ id, row: r.row, changes });
      plan.byPreviewRow.set(r.id, { kind: "update", changes });
      continue;
    }
    if (id !== null && used.has(id)) plan.repeatedIds += 1;
    else if (id !== null) plan.unknownIds += 1;
    plan.add.push(r.row);
    plan.byPreviewRow.set(r.id, { kind: "add" });
  }
  plan.matched = used.size > 0;
  if (plan.matched) {
    plan.missing = list
      .filter((r) => !used.has(r.id))
      .map((r) => ({ id: r.id, name: r.name.trim() || "Unnamed component", installYear: r.installYear.trim() }));
  }
  return plan;
}

/** How many of the list's rows the file changes. */
export function changedCount(plan: ImportPlan): number {
  return plan.update.filter((u) => u.changes.length > 0).length;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/**
 * The button that applies the import: "Add 23 rows", or for a component list
 * download "Update 2 rows, add 1 and remove 3". Null when it would change nothing.
 */
export function applyLabel(plan: ImportPlan, removeMissing: boolean): string | null {
  if (!plan.matched) return plan.add.length > 0 ? `Add ${plural(plan.add.length, "row")}` : null;
  const parts: string[] = [];
  const changed = changedCount(plan);
  if (changed > 0) parts.push(`update ${plural(changed, "row")}`);
  if (plan.add.length > 0) parts.push(`add ${parts.length > 0 ? plan.add.length.toLocaleString("en-US") : plural(plan.add.length, "row")}`);
  if (removeMissing && plan.missing.length > 0) {
    parts.push(`remove ${parts.length > 0 ? plan.missing.length.toLocaleString("en-US") : plural(plan.missing.length, "row")}`);
  }
  if (parts.length === 0) return null;
  const text = listText(parts);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The summary of a component list download read against the list:
 * "Matched 20 rows of your list by CapexClock ID: 2 changed, 18 the same. 1 new row to add."
 */
export function planSummary(plan: ImportPlan): string[] {
  if (!plan.matched) {
    return plan.unknownIds > 0
      ? [
          "None of the CapexClock IDs in this file are in this list, so every row is added as new. To update a list, import the file you downloaded from it.",
        ]
      : [];
  }
  const changed = changedCount(plan);
  const same = plan.update.length - changed;
  const parts = [changed > 0 ? `${changed.toLocaleString("en-US")} to update` : "", same > 0 ? `${same.toLocaleString("en-US")} the same` : ""];
  const lines = [`Matched ${plural(plan.update.length, "row")} of your list by CapexClock ID: ${listText(parts.filter(Boolean))}.`];
  if (plan.add.length > 0) lines.push(`${plural(plan.add.length, "new row")} to add.`);
  const fresh = plan.unknownIds + plan.repeatedIds;
  if (fresh > 0) {
    lines.push(
      `${plural(fresh, "row has", "rows have")} a CapexClock ID that isn't in your list or is on another row too, so ${
        fresh === 1 ? "it's" : "they're"
      } added as new.`,
    );
  }
  if (plan.missing.length > 0) {
    lines.push(`${plural(plan.missing.length, "row")} in your list ${plan.missing.length === 1 ? "isn't" : "aren't"} in this file.`);
  }
  return lines;
}

/**
 * The preview's summary, which the live region reads out. A file without
 * CapexClock IDs only adds: "23 rows to add: 15 ready, 8 changed." A component
 * list download says what it does to the list, removals included:
 * "7 rows: 1 to update, 1 to add and 5 the same. 7 ready. 1 row in your list isn't in this file and will stay."
 */
export function importSummary(counts: Preview["counts"], plan: ImportPlan, removeMissing: boolean): string {
  if (!plan.matched) return previewSummary(counts);
  const changed = changedCount(plan);
  const same = plan.update.length - changed;
  const parts: string[] = [];
  if (changed > 0) parts.push(`${changed.toLocaleString("en-US")} to update`);
  if (plan.add.length > 0) parts.push(`${plan.add.length.toLocaleString("en-US")} to add`);
  if (same > 0) parts.push(`${same.toLocaleString("en-US")} the same`);
  const rows = plan.update.length + plan.add.length;
  const lines = [`${plural(rows, "row")}: ${listText(parts)}.`];
  const status = statusText(counts);
  if (status) lines.push(`${status.charAt(0).toUpperCase()}${status.slice(1)}.`);
  const missing = plan.missing.length;
  if (missing > 0) {
    lines.push(
      `${plural(missing, "row")} in your list ${missing === 1 ? "isn't" : "aren't"} in this file and will ${removeMissing ? "be removed" : "stay"}.`,
    );
  }
  return `${lines.join(" ")}${skippedText(counts)}`;
}

/** Most rows the remove choice names itself; past this, every one is listed above it. */
export const MISSING_NAMED = 4;

/** Every row the file doesn't have is listed above the remove choice, so none is removed unseen. */
export function listsMissing(missing: readonly unknown[]): boolean {
  return missing.length > MISSING_NAMED;
}

/** One row in the list of rows the file doesn't have: "Gas furnace, installed 2011", so two of a kind can be told apart. */
export function missingLine(row: { name: string; installYear: string }): string {
  return row.installYear === "" ? row.name : `${row.name}, installed ${row.installYear}`;
}

/**
 * The choice to remove rows the file doesn't have: "Remove Boiler and Carpet from
 * my list", or "Remove these 7 rows from my list" under a list of all 7.
 */
export function removeText(missing: readonly { name: string }[]): string {
  if (listsMissing(missing)) return `Remove these ${plural(missing.length, "row")} from my list`;
  return `Remove ${listText(missing.map((m) => m.name))} from my list`;
}

/** What one preview row does to the list, said under it; null when there's nothing to say. */
export function listNote(plan: ImportPlan, previewRowId: string): string | null {
  const entry = plan.byPreviewRow.get(previewRowId);
  if (!entry || !plan.matched) return null;
  if (entry.kind === "add") return "New: added to your list.";
  return entry.changes.length > 0 ? `Changes your list: ${entry.changes.join(". ")}.` : null;
}

/** Every row's note, by preview row id, for the preview. */
export function listNotes(plan: ImportPlan): Map<string, string> {
  const notes = new Map<string, string>();
  for (const id of plan.byPreviewRow.keys()) {
    const note = listNote(plan, id);
    if (note) notes.set(id, note);
  }
  return notes;
}

/** The building's unit count or year built from the sheet, and the list's. */
export interface DetailChange {
  field: "unitCount" | "yearBuilt";
  value: string;
  current: string;
}

/**
 * The sheet's unit count and year built against the list's: blank ones in the list
 * are filled in, and different ones are asked about. Equal ones aren't mentioned.
 */
export function sheetDetails(
  building: Pick<BuildingInfo, "unitCount" | "yearBuilt"> | undefined,
  list: { unitCount: string; yearBuilt: string },
): { fill: DetailChange[]; ask: DetailChange[] } {
  const fill: DetailChange[] = [];
  const ask: DetailChange[] = [];
  if (!building) return { fill, ask };
  const check = (field: DetailChange["field"], value: number | null, current: string) => {
    if (value === null) return;
    const change = { field, value: String(value), current: current.trim() };
    if (change.current === "") fill.push(change);
    else if (!sameNumber(change.current, change.value)) ask.push(change);
  };
  check("unitCount", building.unitCount, list.unitCount);
  check("yearBuilt", building.yearBuilt, list.yearBuilt);
  return { fill, ask };
}

/** "Rental units and year built come from the sheet: 12 units, built 1998." */
export function fillText(fill: readonly DetailChange[]): string {
  if (fill.length === 0) return "";
  const what = listText(fill.map((f) => (f.field === "unitCount" ? "rental units" : "year built")));
  const values = listText(fill.map((f) => (f.field === "unitCount" ? plural(Number(f.value), "unit") : `built ${f.value}`)));
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} will come from the sheet: ${values}.`;
}

/** "Change rental units from 14 to 12" */
export function askText(change: DetailChange): string {
  return `Change ${change.field === "unitCount" ? "rental units" : "year built"} from ${change.current} to ${change.value}`;
}

/** What the list hears once the import is applied: "Updated 2 rows and added 1 from your spreadsheet." */
export function doneText(plan: ImportPlan, removed: number): string {
  if (!plan.matched) return `Added ${plural(plan.add.length, "row")} from your spreadsheet.`;
  const changed = changedCount(plan);
  const parts: string[] = [];
  if (changed > 0) parts.push(`updated ${plural(changed, "row")}`);
  if (plan.add.length > 0) parts.push(`added ${parts.length > 0 ? plan.add.length.toLocaleString("en-US") : plural(plan.add.length, "row")}`);
  if (removed > 0) parts.push(`removed ${parts.length > 0 ? removed.toLocaleString("en-US") : plural(removed, "row")}`);
  if (parts.length === 0) return "Your list already matched the spreadsheet.";
  const text = listText(parts);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} from your spreadsheet.`;
}
