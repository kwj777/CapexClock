import { replacementCost } from "@/engine";
import { defaultLife, type LibraryComponent } from "../library/components";
import type { TypicalCost } from "../library/typical-costs";
import { parseNumber } from "../parse";
import type { UnitLabel } from "../units";
import { newRowId } from "./ids";
import { CONDITION_TEXT, MAX_NOTES_LENGTH, type Draft, type DraftRow } from "./model";

/**
 * The starting quantity for a way of counting: one per unit follows the unit
 * count, a building item starts at 1, and only the owner knows the square feet.
 */
function quantityFor(unitLabel: UnitLabel, unitCount: string): Pick<DraftRow, "quantity" | "followsUnitCount"> {
  if (unitLabel === "per_unit") return { quantity: unitCount, followsUnitCount: true };
  return { quantity: unitLabel === "per_building" ? "1" : "", followsUnitCount: false };
}

export function rowFromLibrary(item: LibraryComponent, unitCount: string): DraftRow {
  return {
    id: newRowId(),
    librarySlug: item.slug,
    category: item.category,
    name: item.name,
    ...quantityFor(item.unitLabel, unitCount),
    unitLabel: item.unitLabel,
    installYear: "",
    usefulLife: String(defaultLife(item)),
    costEach: "",
    scenario: "run_to_failure",
  };
}

export function customRow(): DraftRow {
  return {
    id: newRowId(),
    librarySlug: null,
    category: "Other",
    name: "",
    quantity: "1",
    unitLabel: "per_building",
    installYear: "",
    usefulLife: "",
    costEach: "",
    scenario: "run_to_failure",
    followsUnitCount: false,
  };
}

/**
 * True when a row's quantity is still the one its way of counting started with
 * (or blank), so changing how it's counted loses nothing the owner typed.
 */
function hasStartingQuantity(row: DraftRow): boolean {
  const quantity = row.quantity.trim();
  if (quantity === "") return true;
  if (row.unitLabel === "per_unit") return row.followsUnitCount === true;
  return row.unitLabel === "per_building" && quantity === "1";
}

/**
 * Applies an edit to one row. Typing a quantity stops it following the unit
 * count. Changing how it's counted resets a starting quantity to fit the new
 * way, but keeps one the owner typed, so arrowing through the picker (which
 * changes it on every key press in some browsers) never loses their number.
 */
export function editRow(row: DraftRow, patch: Partial<DraftRow>, unitCount: string): DraftRow {
  const next = { ...row, ...patch };
  if (patch.quantity !== undefined) return { ...next, followsUnitCount: false };
  if (patch.unitLabel !== undefined && patch.unitLabel !== row.unitLabel && hasStartingQuantity(row)) {
    return { ...next, ...quantityFor(patch.unitLabel, unitCount) };
  }
  return next;
}

/** Values typed for one component on a lifespan page. Blank ones are left out. */
export interface ItemValues {
  installYear: string;
  quantity: string;
  costEach: string;
}

/**
 * Puts a library component from a lifespan page into the draft: "add" appends
 * a new row, "update" fills the values into the row the draft already has for it.
 */
export function withLibraryItem(
  draft: Draft,
  item: LibraryComponent,
  values: ItemValues,
  mode: "add" | "update",
): Draft {
  const typed: Partial<DraftRow> = {};
  if (values.installYear.trim()) typed.installYear = values.installYear.trim();
  if (values.quantity.trim()) typed.quantity = values.quantity.trim();
  if (values.costEach.trim()) typed.costEach = values.costEach.trim();

  const existing = draft.rows.findIndex((r) => r.librarySlug === item.slug);
  if (mode === "update" && existing >= 0) {
    return {
      ...draft,
      rows: draft.rows.map((r, i) => (i === existing ? fillRow(r, typed, draft.unitCount) : r)),
    };
  }
  const row = fillRow(rowFromLibrary(item, draft.unitCount), typed, draft.unitCount);
  // A draft with nothing in it yet starts a new forecast in the calculator.
  return { ...draft, forecastTracked: draft.rows.length > 0 && draft.forecastTracked, rows: [...draft.rows, row] };
}

/**
 * The lifespan page asks for a cost each. With no count typed, a row following
 * the unit count would take that cost as per apartment (one window's price for
 * all of an apartment's windows), so its count is left blank for the owner.
 */
function fillRow(row: DraftRow, typed: Partial<DraftRow>, unitCount: string): DraftRow {
  const costWithoutCount = typed.costEach !== undefined && typed.quantity === undefined;
  if (costWithoutCount && row.unitLabel === "per_unit" && row.followsUnitCount) {
    return editRow(row, { ...typed, quantity: "" }, unitCount);
  }
  return editRow(row, typed, unitCount);
}

/** Quantity × cost for a row, or null until both are readable numbers. */
export function rowTotal(row: Pick<DraftRow, "quantity" | "costEach">): { quantity: number; each: number; total: number } | null {
  const quantity = parseNumber(row.quantity);
  const each = parseNumber(row.costEach);
  if (quantity === null || each === null || !Number.isFinite(quantity) || !Number.isFinite(each)) return null;
  if (quantity <= 0 || each < 0) return null;
  return { quantity, each, total: replacementCost({ quantity, replacementCostEach: each }) };
}

/** What one "cost" pays for in a row. */
export type CostBasis = "apartment" | "sq_ft" | "building" | "each";

/**
 * What one "cost" pays for, so the quantity × cost math reads right. A per-unit
 * row at the unit count is priced per apartment (all its windows, say); once the
 * owner types their own count it's priced each.
 */
export function costBasis(row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount">): CostBasis {
  if (row.unitLabel === "per_sq_ft") return "sq_ft";
  if (row.unitLabel === "per_unit") return row.followsUnitCount ? "apartment" : "each";
  return row.quantity.trim() === "1" ? "building" : "each";
}

const COST_LABELS: Record<CostBasis, string> = {
  apartment: "Cost per apartment",
  sq_ft: "Cost per sq ft",
  building: "Cost for the building",
  each: "Cost each",
};

/** The cost field's label (see costBasis). */
export function costLabel(row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount">): string {
  return COST_LABELS[costBasis(row)];
}

/** What a cost means for a library item counted the library's way. */
const LIBRARY_COST_BASIS: Record<UnitLabel, CostBasis> = {
  per_unit: "apartment",
  per_sq_ft: "sq_ft",
  per_building: "building",
};

/**
 * The typical cost a row's cost field can show as a hint, from the library item.
 * Only while the field and the typical cost mean the same thing, per apartment or per
 * sq ft. A cost each (the owner's own count: one window, not an apartment's
 * eight) or for the building can't be compared with them, so those get no hint.
 * Neither does a building-wide item counted per apartment: its typical cost is a
 * 12-unit building's boiler or roof shared out, and one in each apartment costs
 * far more. The hint is never used in the math.
 */
export function typicalCostFor(
  row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount">,
  lib: LibraryComponent | undefined,
  typical: TypicalCost | undefined,
): { low: number; high: number } | null {
  if (!lib || !typical || LIBRARY_COST_BASIS[lib.unitLabel] !== typical.per) return null;
  if (costBasis(row) !== typical.per) return null;
  return { low: typical.low, high: typical.high };
}

/**
 * Whether a row's condition and notes show on narrow screens: as the owner last
 * chose with More or Less (null until they do), or else open while the notes need
 * fixing. The row forgets the choice when a new problem comes up, so it opens again.
 */
export function detailsShown(chosen: boolean | null, notesNeedFixing: boolean): boolean {
  return chosen ?? notesNeedFixing;
}

/**
 * Notes longer than a save takes, counted as the database counts them (an emoji is
 * one). The box stops typing at the limit, so only a kept draft or an import gets here.
 */
export function notesTooLong(notes: string): boolean {
  return Array.from(notes).length > MAX_NOTES_LENGTH;
}

/**
 * How many more characters the notes can take, once that's 200 or fewer, or how
 * many too many once they're over the limit; null before then.
 */
export function notesLeftText(notes: string): string | null {
  if (notesTooLong(notes)) {
    const over = Array.from(notes).length - MAX_NOTES_LENGTH;
    return `${over.toLocaleString("en-US")} character${over === 1 ? "" : "s"} over the ${MAX_NOTES_LENGTH.toLocaleString("en-US")} limit`;
  }
  const left = Math.max(0, MAX_NOTES_LENGTH - notes.length);
  if (left > 200) return null;
  return `${left.toLocaleString("en-US")} character${left === 1 ? "" : "s"} left`;
}

/** What a row's hidden condition and notes hold, e.g. "Fair, notes"; empty when nothing. */
export function detailsSummary(row: Pick<DraftRow, "condition" | "notes">): string {
  return [row.condition ? CONDITION_TEXT[row.condition] : "", (row.notes ?? "").trim() ? "notes" : ""]
    .filter(Boolean)
    .join(", ");
}

/** Unit count for the forecast: blank or unreadable counts as zero, never negative. */
export function parseUnitCount(value: string): number {
  const n = parseNumber(value);
  return n !== null && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Sets the unit count and carries it to the per-unit rows that follow it, so
 * "12 water heaters" becomes 14 when the building has 14 units. Quantities the
 * owner typed are never changed.
 */
export function withUnitCount(draft: Draft, unitCount: string): Draft {
  return {
    ...draft,
    unitCount,
    rows: draft.rows.map((r) =>
      r.unitLabel === "per_unit" && r.followsUnitCount ? { ...r, quantity: unitCount } : r,
    ),
  };
}

/** Where focus goes when a row is removed: the next row, else the one before, else nowhere. */
export function neighborRowId(rows: Pick<DraftRow, "id">[], id: string): string | null {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  return rows[i + 1]?.id ?? rows[i - 1]?.id ?? null;
}

/** True when the draft holds anything the owner typed or loaded. */
export function hasEntries(draft: Draft): boolean {
  return draft.rows.length > 0 || draft.unitCount.trim() !== "" || draft.yearBuilt.trim() !== "";
}
