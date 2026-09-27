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
}

export interface Draft {
  unitCount: string;
  yearBuilt: string;
  rows: DraftRow[];
}

export const EMPTY_DRAFT: Draft = { unitCount: "", yearBuilt: "", rows: [] };

const STORAGE_KEY = "capexclock:calculator:v1";

export function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) return parsed;
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

let idCounter = 0;
export function newRowId(): string {
  idCounter += 1;
  return `row-${Date.now().toString(36)}-${idCounter}`;
}

export function rowFromLibrary(item: LibraryComponent, unitCount: string): DraftRow {
  return {
    id: newRowId(),
    librarySlug: item.slug,
    category: item.category,
    name: item.name,
    // One per unit is the common case for in-unit items; sq ft must be entered.
    quantity: item.unitLabel === "per_unit" ? unitCount : item.unitLabel === "per_building" ? "1" : "",
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
  };
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
 * Sets the unit count and carries it to per-unit rows still at the old count,
 * so "12 water heaters" becomes 14 when the building has 14 units.
 */
export function withUnitCount(draft: Draft, unitCount: string): Draft {
  return {
    ...draft,
    unitCount,
    rows: draft.rows.map((r) =>
      r.unitLabel === "per_unit" && (r.quantity === draft.unitCount || r.quantity === "")
        ? { ...r, quantity: unitCount }
        : r,
    ),
  };
}

export const EARLIEST_INSTALL_YEAR = 1900;

export type RowProblem =
  | "missing_name"
  | "missing_install_year"
  | "bad_install_year"
  | "missing_cost"
  | "invalid";

export interface ConvertedRows {
  components: ForecastComponent[];
  problems: Record<string, RowProblem>;
}

/** Turns form rows into forecast components; rows that aren't complete are reported, not guessed. */
export function toComponents(draft: Draft, currentYear: number): ConvertedRows {
  const yearBuilt = parseNumber(draft.yearBuilt);
  const components: ForecastComponent[] = [];
  const problems: Record<string, RowProblem> = {};

  for (const row of draft.rows) {
    if (!row.name.trim()) {
      problems[row.id] = "missing_name";
      continue;
    }
    const explicitYear = parseNumber(row.installYear);
    const installYear = explicitYear ?? yearBuilt;
    if (installYear === null) {
      problems[row.id] = "missing_install_year";
      continue;
    }
    // Catches typos like "98" or "2106", which would otherwise read as long overdue or never due.
    if (!Number.isInteger(installYear) || installYear < EARLIEST_INSTALL_YEAR || installYear > currentYear) {
      problems[row.id] = "bad_install_year";
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
  missing_cost: "Add a replacement cost to include it.",
  invalid: "Check quantity (above 0), useful life (1–100 years) and cost (a plain number like 1400).",
};

/** A small 12-unit example so first-time visitors can see a forecast immediately. */
export function exampleDraft(): Draft {
  const row = (r: Omit<DraftRow, "id" | "scenario">): DraftRow => ({
    ...r,
    id: newRowId(),
    scenario: "run_to_failure",
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
