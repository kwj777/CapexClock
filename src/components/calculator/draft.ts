import type { ForecastComponent, Scenario, UnitLabel } from "@/lib/forecast";
import { validateComponent } from "@/lib/forecast";
import type { ImportedRow } from "@/lib/import/preview";
import { defaultLife, type LibraryComponent } from "@/lib/library/components";
import type { ComponentCondition } from "@/lib/supabase/database.types";

// Form state keeps raw strings so inputs can be empty or mid-edit.
export interface DraftRow {
  id: string;
  librarySlug: string | null;
  category: string;
  name: string;
  quantity: string;
  unitLabel: UnitLabel;
  installYear: string;
  usefulLife: string;
  costEach: string;
  scenario: Scenario;
  /**
   * True while a per-unit row's quantity tracks the unit count. Set when the row
   * is created from the unit count, cleared once the owner types a quantity.
   * Not saved to the database; loading a property works it out again.
   */
  followsUnitCount?: boolean;
  // Drafts saved before these three existed don't have them; missing means not set.
  /** The owner's rating of the component; null or missing when not set. */
  condition?: ComponentCondition | null;
  /** Anything the owner wants to remember about it, up to MAX_NOTES_LENGTH characters. */
  notes?: string;
  /** The owner ticked "guess" next to the install year. */
  installYearIsGuess?: boolean;
}

/** The condition choices, in the order the picker shows them. */
export const CONDITIONS: readonly ComponentCondition[] = ["good", "fair", "poor"];

export const CONDITION_TEXT: Record<ComponentCondition, string> = { good: "Good", fair: "Fair", poor: "Poor" };

/** Longest notes the database keeps, in characters. */
export const MAX_NOTES_LENGTH = 2000;

export interface Draft {
  unitCount: string;
  yearBuilt: string;
  rows: DraftRow[];
  /** forecast_generated was already sent for this draft (public calculator only). */
  forecastTracked?: boolean;
}

export const EMPTY_DRAFT: Draft = { unitCount: "", yearBuilt: "", rows: [] };

export const STORAGE_KEY = "capexclock:calculator:v1";

export function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) return upgradeDraft(parsed, new Date().getFullYear());
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return EMPTY_DRAFT;
}

export function saveDraft(draft: Draft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked; the calculator still works without it.
  }
}

/**
 * The list before an import on the template page changed it, kept for this tab
 * only, so the calculator it opens can offer Undo as it does after its own imports.
 */
export const IMPORT_UNDO_KEY = "capexclock:calculator:import-undo:v1";

export function saveImportUndo(before: Draft, after: Draft): void {
  try {
    window.sessionStorage.setItem(IMPORT_UNDO_KEY, JSON.stringify({ before, after }));
  } catch {
    // Storage blocked: the import still works, without an undo.
  }
}

/** The kept list, if `current` is still what the import left; read without removing it. */
export function peekImportUndo(current: Draft, currentYear: number): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(IMPORT_UNDO_KEY);
    return raw ? importUndoFor(JSON.parse(raw), current, currentYear) : null;
  } catch {
    return null;
  }
}

export function clearImportUndo(): void {
  try {
    window.sessionStorage.removeItem(IMPORT_UNDO_KEY);
  } catch {
    // Nothing to clear.
  }
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

function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.unitCount === "string" &&
    typeof v.yearBuilt === "string" &&
    Array.isArray(v.rows) &&
    v.rows.every((r) => typeof r === "object" && r !== null && typeof (r as DraftRow).id === "string")
  );
}

/**
 * Fills in flags that drafts saved before they existed don't have, and drops any
 * condition, notes or guess flag the calculator can't use.
 */
export function upgradeDraft(draft: Draft, currentYear: number): Draft {
  const rows = draft.rows.map(cleanDetails);
  return {
    ...draft,
    // An older draft that already shows a forecast has already been counted.
    forecastTracked: draft.forecastTracked ?? toComponents({ ...draft, rows }, currentYear).components.length > 0,
    rows: rows.map((r) =>
      r.followsUnitCount === undefined
        ? { ...r, followsUnitCount: quantityMatchesUnits(r, draft.unitCount) || blankPerUnit(r) }
        : r,
    ),
  };
}

// Before the flag, a blank per-unit quantity was filled in from the unit count too.
function blankPerUnit(row: Pick<DraftRow, "unitLabel" | "quantity">): boolean {
  return row.unitLabel === "per_unit" && row.quantity.trim() === "";
}

/** A per-unit row whose quantity is the unit count is taken to follow it (used for loaded rows). */
export function quantityMatchesUnits(row: Pick<DraftRow, "unitLabel" | "quantity">, unitCount: string): boolean {
  return row.unitLabel === "per_unit" && row.quantity === unitCount;
}

/**
 * Drops a stored condition, notes or guess flag that isn't one the calculator could
 * have written, so a damaged copy in this browser can't break the page or a save.
 * A row with nothing to drop comes back as it was.
 */
export function cleanDetails(row: DraftRow): DraftRow {
  const { condition, notes, installYearIsGuess } = row as {
    condition?: unknown;
    notes?: unknown;
    installYearIsGuess?: unknown;
  };
  const badCondition =
    condition !== undefined && condition !== null && !CONDITIONS.some((c) => c === condition);
  const badNotes = notes !== undefined && typeof notes !== "string";
  const badGuess = installYearIsGuess !== undefined && typeof installYearIsGuess !== "boolean";
  if (!badCondition && !badNotes && !badGuess) return row;
  const clean = { ...row };
  if (badCondition) delete clean.condition;
  if (badNotes) delete clean.notes;
  if (badGuess) delete clean.installYearIsGuess;
  return clean;
}

let idCounter = 0;
export function newRowId(): string {
  idCounter += 1;
  return `row-${Date.now().toString(36)}-${idCounter}`;
}

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
  return { quantity, each, total: quantity * each };
}

/**
 * The cost field's label: what one "cost" pays for, so the quantity × cost math
 * reads right. A per-unit row at the unit count is priced per apartment (all its
 * windows, say); once the owner types their own count it's priced each.
 */
export function costLabel(row: Pick<DraftRow, "unitLabel" | "quantity" | "followsUnitCount">): string {
  if (row.unitLabel === "per_sq_ft") return "Cost per sq ft";
  if (row.unitLabel === "per_unit") return row.followsUnitCount ? "Cost per apartment" : "Cost each";
  return row.quantity.trim() === "1" ? "Cost for the building" : "Cost each";
}

/** How many more characters the notes can take, once that's 200 or fewer; null before then. */
export function notesLeftText(notes: string): string | null {
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

/** Null when blank; NaN when something was typed that isn't a number (e.g. "1.4k"). */
function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  return Number(cleaned);
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

/** Earliest install year a component can be given; older buildings use year built instead. */
export const EARLIEST_INSTALL_YEAR = 1900;
/** Earliest year built, matching the database. */
export const EARLIEST_YEAR_BUILT = 1800;

// Catches typos like "98" or "2106", which would otherwise read as long overdue or never due.
function isYearBetween(year: number, earliest: number, currentYear: number): boolean {
  return Number.isInteger(year) && year >= earliest && year <= currentYear;
}

/** True when year built is filled in but can't be a real year built. */
export function badYearBuilt(value: string, currentYear: number): boolean {
  const year = parseNumber(value);
  return year !== null && !isYearBetween(year, EARLIEST_YEAR_BUILT, currentYear);
}

export const YEAR_BUILT_TEXT = `Year built should be a 4-digit year from ${EARLIEST_YEAR_BUILT} to this year.`;

export type RowProblem =
  | "missing_name"
  | "missing_install_year"
  | "bad_install_year"
  | "bad_year_built"
  | "missing_cost"
  | "invalid";

export interface ConvertedRows {
  components: ForecastComponent[];
  problems: Record<string, RowProblem>;
}

/** Turns form rows into forecast components; rows that aren't complete are reported, not guessed. */
export function toComponents(draft: Draft, currentYear: number): ConvertedRows {
  const yearBuilt = parseNumber(draft.yearBuilt);
  const yearBuiltIsBad = badYearBuilt(draft.yearBuilt, currentYear);
  const components: ForecastComponent[] = [];
  const problems: Record<string, RowProblem> = {};

  for (const row of draft.rows) {
    if (!row.name.trim()) {
      problems[row.id] = "missing_name";
      continue;
    }
    const explicitYear = parseNumber(row.installYear);
    if (explicitYear !== null && !isYearBetween(explicitYear, EARLIEST_INSTALL_YEAR, currentYear)) {
      problems[row.id] = "bad_install_year";
      continue;
    }
    // A blank install year falls back to year built, which is checked on its own.
    if (explicitYear === null && yearBuiltIsBad) {
      problems[row.id] = "bad_year_built";
      continue;
    }
    const installYear = explicitYear ?? yearBuilt;
    if (installYear === null) {
      problems[row.id] = "missing_install_year";
      continue;
    }
    const cost = parseNumber(row.costEach);
    if (cost === null) {
      problems[row.id] = "missing_cost";
      continue;
    }
    const component: ForecastComponent = {
      id: row.id,
      category: row.category,
      name: row.name.trim(),
      quantity: parseNumber(row.quantity) ?? NaN,
      installYear,
      // Year built standing in for a blank year, or a year the owner says is a guess.
      installYearIsEstimate: explicitYear === null || row.installYearIsGuess === true,
      usefulLifeYears: parseNumber(row.usefulLife) ?? NaN,
      replacementCostEach: cost,
      scenario: row.scenario,
    };
    if (validateComponent(component).length > 0) {
      problems[row.id] = "invalid";
      continue;
    }
    components.push(component);
  }

  return { components, problems };
}

export const PROBLEM_TEXT: Record<RowProblem, string> = {
  missing_name: "Name this component.",
  missing_install_year: "Add an install year, or the building's year built.",
  bad_install_year: `Install year should be a 4-digit year from ${EARLIEST_INSTALL_YEAR} to this year.`,
  bad_year_built: "Fix the year built above, or add an install year.",
  missing_cost: "Add a replacement cost to include it.",
  invalid: "Check quantity (above 0), useful life (1–100 years) and cost (a plain number like 1400).",
};

/** A row's fields that a problem can point at. */
export type RowField = "name" | "quantity" | "installYear" | "usefulLife" | "costEach" | "notes";

type NumberField = "quantity" | "usefulLife" | "costEach";

/** The number fields that stop a named, dated, costed row from being used. */
function invalidFields(row: DraftRow): NumberField[] {
  const bad: NumberField[] = [];
  const quantity = parseNumber(row.quantity);
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) bad.push("quantity");
  const life = parseNumber(row.usefulLife);
  if (life === null || !Number.isInteger(life) || life < 1 || life > 100) bad.push("usefulLife");
  const cost = parseNumber(row.costEach);
  if (cost === null || !Number.isFinite(cost) || cost < 0) bad.push("costEach");
  return bad;
}

/** The fields to mark for a row's problem, so the message can point at them. */
export function problemFields(row: DraftRow, problem: RowProblem): RowField[] {
  switch (problem) {
    case "missing_name":
      return ["name"];
    case "missing_install_year":
    case "bad_install_year":
    case "bad_year_built":
      return ["installYear"];
    case "missing_cost":
      return ["costEach"];
    case "invalid":
      return invalidFields(row);
  }
}

/** What to tell the owner about a row's problem; for a bad number, says which one. */
export function problemText(row: DraftRow, problem: RowProblem): string {
  if (problem !== "invalid") return PROBLEM_TEXT[problem];
  const text: Record<NumberField, string> = {
    quantity:
      row.unitLabel === "per_sq_ft"
        ? "Square feet should be a number above 0, like 1200."
        : "Quantity should be a number above 0, like 12.",
    usefulLife: "Useful life should be a whole number of years from 1 to 100.",
    costEach: "Cost should be a plain number, like 1400.",
  };
  const fields = invalidFields(row);
  return fields.length > 0 ? fields.map((f) => text[f]).join(" ") : PROBLEM_TEXT.invalid;
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

/** A small 12-unit example so first-time visitors can see a forecast immediately. */
export function exampleDraft(): Draft {
  const row = (r: Omit<DraftRow, "id" | "scenario" | "followsUnitCount">): DraftRow => ({
    ...r,
    id: newRowId(),
    scenario: "run_to_failure",
    followsUnitCount: quantityMatchesUnits(r, "12"),
  });
  return {
    unitCount: "12",
    yearBuilt: "1998",
    rows: [
      row({ librarySlug: "asphalt-shingle-roof", category: "Roofing", name: "Asphalt shingle roof", quantity: "1", unitLabel: "per_building", installYear: "2008", usefulLife: "22", costEach: "38000" }),
      row({ librarySlug: "gas-furnace", category: "HVAC", name: "Gas furnace", quantity: "12", unitLabel: "per_unit", installYear: "2012", usefulLife: "18", costEach: "4200" }),
      row({ librarySlug: "tank-water-heater", category: "Plumbing", name: "Tank water heater", quantity: "12", unitLabel: "per_unit", installYear: "2016", usefulLife: "10", costEach: "1400" }),
      row({ librarySlug: "refrigerator", category: "Appliances", name: "Refrigerator", quantity: "12", unitLabel: "per_unit", installYear: "", usefulLife: "13", costEach: "1100" }),
      row({ librarySlug: "carpet", category: "Flooring", name: "Carpet", quantity: "9600", unitLabel: "per_sq_ft", installYear: "2020", usefulLife: "8", costEach: "4" }),
      row({ librarySlug: "parking-lot-seal-coat", category: "Site", name: "Parking lot seal coat", quantity: "8000", unitLabel: "per_sq_ft", installYear: "2023", usefulLife: "4", costEach: "0.25" }),
    ],
  };
}
