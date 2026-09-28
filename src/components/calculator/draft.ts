import type { ForecastComponent, Scenario, UnitLabel } from "@/lib/forecast";
import { validateComponent } from "@/lib/forecast";
import { defaultLife, type LibraryComponent } from "@/lib/library/components";

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
}

export interface Draft {
  unitCount: string;
  yearBuilt: string;
  rows: DraftRow[];
  /** forecast_generated was already sent for this draft (public calculator only). */
  forecastTracked?: boolean;
}

export const EMPTY_DRAFT: Draft = { unitCount: "", yearBuilt: "", rows: [] };

const STORAGE_KEY = "capexclock:calculator:v1";

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

/** Fills in flags that drafts saved before they existed don't have. */
export function upgradeDraft(draft: Draft, currentYear: number): Draft {
  return {
    ...draft,
    // An older draft that already shows a forecast has already been counted.
    forecastTracked: draft.forecastTracked ?? toComponents(draft, currentYear).components.length > 0,
    rows: draft.rows.map((r) =>
      r.followsUnitCount === undefined
        ? { ...r, followsUnitCount: quantityMatchesUnits(r, draft.unitCount) }
        : r,
    ),
  };
}

/** A per-unit row whose quantity is the unit count is taken to follow it (used for loaded rows). */
export function quantityMatchesUnits(row: Pick<DraftRow, "unitLabel" | "quantity">, unitCount: string): boolean {
  return row.unitLabel === "per_unit" && row.quantity === unitCount;
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
 * Applies an edit to one row. Typing a quantity stops it following the unit
 * count. Changing how it's counted resets the quantity to fit the new way.
 */
export function editRow(row: DraftRow, patch: Partial<DraftRow>, unitCount: string): DraftRow {
  const next = { ...row, ...patch };
  if (patch.unitLabel !== undefined && patch.unitLabel !== row.unitLabel) {
    return { ...next, ...quantityFor(patch.unitLabel, unitCount) };
  }
  if (patch.quantity !== undefined) next.followsUnitCount = false;
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
      rows: draft.rows.map((r, i) => (i === existing ? editRow(r, typed, draft.unitCount) : r)),
    };
  }
  const row = editRow(rowFromLibrary(item, draft.unitCount), typed, draft.unitCount);
  // A draft with nothing in it yet starts a new forecast in the calculator.
  return { ...draft, forecastTracked: draft.rows.length > 0 && draft.forecastTracked, rows: [...draft.rows, row] };
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
      installYearIsEstimate: explicitYear === null,
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
