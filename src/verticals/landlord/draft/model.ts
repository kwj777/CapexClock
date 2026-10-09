import type { Scenario } from "@/engine";
import { isSafetyBuffer, type SafetyBuffer } from "../rules";
import type { UnitLabel } from "../units";
import { toComponents } from "./components";

/** The owner's own rating of a component. Mirrors the database's component_condition. */
export type ComponentCondition = "good" | "fair" | "poor";

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
  /** Safety buffer in percent (0, 10 or 20) on the monthly reserve. Missing in older drafts, meaning none. */
  safetyBuffer?: SafetyBuffer;
  /** forecast_generated was already sent for this draft (public calculator only). */
  forecastTracked?: boolean;
}

export const EMPTY_DRAFT: Draft = { unitCount: "", yearBuilt: "", rows: [] };

/** True when a value read back from storage has a draft's shape. */
export function isDraft(value: unknown): value is Draft {
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
  const { safetyBuffer, ...rest } = draft;
  return {
    ...rest,
    // A damaged buffer in this browser is dropped (none) rather than break the forecast.
    ...(isSafetyBuffer(safetyBuffer) ? { safetyBuffer } : {}),
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
