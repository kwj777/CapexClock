import type { UnitLabel } from "../units";
import { newRowId } from "./ids";
import { isDraft, quantityMatchesUnits, upgradeDraft, type ComponentCondition, type Draft, type DraftRow } from "./model";
import { withUnitCount } from "./rows";

/** A row ready for the draft. Strings, like the form's own fields. */
export interface ImportedRow {
  librarySlug: string | null;
  category: string;
  name: string;
  quantity: string;
  unitLabel: UnitLabel;
  installYear: string;
  installYearIsGuess: boolean;
  usefulLife: string;
  costEach: string;
  condition: ComponentCondition | null;
  notes: string;
  /** "Replace now" said yes: plan its replacement this year. */
  replaceNow: boolean;
  /**
   * Counted per unit with no quantity: one in each unit, so its quantity is the
   * unit count of the list it goes into, and follows it. `quantity` is the sheet's
   * unit count for the preview to show, or blank when the sheet doesn't give one.
   */
  followsUnitCount?: boolean;
}
/**
 * An imported row's quantity in a list with this unit count. Quantities stay as the
 * sheet gives them, and a per-unit row follows later unit-count changes only when
 * its quantity is the unit count, or the sheet left it blank (see ImportedRow).
 */
function importedQuantity(row: ImportedRow, unitCount: string): Pick<DraftRow, "quantity" | "followsUnitCount"> {
  if (row.followsUnitCount && row.unitLabel === "per_unit") return { quantity: unitCount, followsUnitCount: true };
  return { quantity: row.quantity, followsUnitCount: quantityMatchesUnits(row, unitCount) };
}

/**
 * Adds rows from an imported spreadsheet after the ones already there; it never
 * replaces them. Quantities are kept as importedQuantity says.
 */
export function withImportedRows(draft: Draft, rows: readonly ImportedRow[]): Draft {
  const added = rows.map((r): DraftRow => ({
    id: newRowId(),
    librarySlug: r.librarySlug,
    category: r.category,
    name: r.name,
    ...importedQuantity(r, draft.unitCount),
    unitLabel: r.unitLabel,
    installYear: r.installYear,
    usefulLife: r.usefulLife,
    costEach: r.costEach,
    scenario: r.replaceNow ? "replace_now" : "run_to_failure",
    condition: r.condition,
    notes: r.notes,
    installYearIsGuess: r.installYearIsGuess,
  }));
  // A draft with nothing in it yet starts a new forecast in the calculator.
  return { ...draft, forecastTracked: draft.rows.length > 0 && draft.forecastTracked, rows: [...draft.rows, ...added] };
}

/** What an import changes: see planImport in src/lib/import/reimport.ts. */
export interface DraftImport {
  add: readonly ImportedRow[];
  /** Rows of the draft to change in place, by id. Their ids stay, so saved history stays attached. */
  update: readonly { id: string; row: ImportedRow }[];
  /** Rows of the draft to remove; only ones the owner chose to. */
  remove: readonly string[];
  /** The building's unit count and year built from the sheet, when the owner chose to use them. */
  unitCount?: string;
  yearBuilt?: string;
}

/**
 * Applies an import: the building's details first, then the rows the sheet changes
 * (in place, keeping their ids), then the removals, then the new rows after the
 * rest. Rows from the sheet take its quantities, as importedQuantity says.
 */
/**
 * The import changes or removes rows, or the building's details, so it replaces
 * something and can be undone. One that only adds rows can't lose anything.
 */
export function importReplaces(change: DraftImport): boolean {
  return change.update.length > 0 || change.remove.length > 0 || change.unitCount !== undefined || change.yearBuilt !== undefined;
}

export function withImport(draft: Draft, change: DraftImport): Draft {
  let next = change.unitCount !== undefined ? withUnitCount(draft, change.unitCount) : draft;
  if (change.yearBuilt !== undefined) next = { ...next, yearBuilt: change.yearBuilt };
  const updates = new Map(change.update.map((u) => [u.id, u.row]));
  const removed = new Set(change.remove);
  const unitCount = next.unitCount;
  const rows = next.rows
    .filter((r) => !removed.has(r.id))
    .map((r): DraftRow => {
      const row = updates.get(r.id);
      if (!row) return r;
      return {
        ...r,
        librarySlug: row.librarySlug,
        category: row.category,
        name: row.name,
        ...importedQuantity(row, unitCount),
        unitLabel: row.unitLabel,
        installYear: row.installYear,
        usefulLife: row.usefulLife,
        costEach: row.costEach,
        scenario: row.replaceNow ? "replace_now" : "run_to_failure",
        condition: row.condition,
        notes: row.notes,
        installYearIsGuess: row.installYearIsGuess,
      };
    });
  return withImportedRows({ ...next, rows }, change.add);
}

function sameEntries(a: Draft, b: Draft): boolean {
  const entries = (d: Draft) => JSON.stringify([d.unitCount, d.yearBuilt, d.rows]);
  return entries(a) === entries(b);
}

/**
 * The list to bring back from a kept copy: its "before", when its "after" is still
 * the list (nothing changed it since, in this tab or another). Null otherwise.
 */
export function importUndoFor(stored: unknown, current: Draft, currentYear: number): Draft | null {
  if (typeof stored !== "object" || stored === null) return null;
  const { before, after } = stored as Record<string, unknown>;
  if (!isDraft(before) || !isDraft(after)) return null;
  return sameEntries(upgradeDraft(after, currentYear), current) ? upgradeDraft(before, currentYear) : null;
}
