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

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type RowProblem = "missing_name" | "missing_install_year" | "missing_cost" | "invalid";

export interface ConvertedRows {
  components: ForecastComponent[];
  problems: Record<string, RowProblem>;
}

/** Turns form rows into forecast components; rows that aren't complete are reported, not guessed. */
export function toComponents(draft: Draft): ConvertedRows {
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
  missing_cost: "Add a replacement cost to include it.",
  invalid: "Check quantity (above 0), useful life (1–100 years) and cost.",
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
