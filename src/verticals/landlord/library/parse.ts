// Pure checks for component_library rows read from the database. The fetching
// stays in the app (src/lib/library/source.ts), which passes the rows in.

import type { UnitLabel } from "../units";
import type { LibraryComponent } from "./components";
import type { TypicalCost, TypicalCostPer } from "./typical-costs";

const UNIT_LABELS: readonly UnitLabel[] = ["per_unit", "per_building", "per_sq_ft"];

/**
 * Slugs become page addresses (/lifespan/<slug>). The database enforces the same
 * rule, and the same "has a letter or number" rule for names and categories, so
 * the table editor refuses a row the site would skip (supabase/migrations/0003).
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
const HAS_WORD = /[\p{L}\p{N}]/u;

function isUnitLabel(value: string): value is UnitLabel {
  return (UNIT_LABELS as readonly string[]).includes(value);
}

const TYPICAL_COST_PERS: readonly TypicalCostPer[] = ["apartment", "sq_ft"];

function isTypicalCostPer(value: unknown): value is TypicalCostPer {
  return typeof value === "string" && (TYPICAL_COST_PERS as readonly string[]).includes(value);
}

/** The component, or why the row can't be used. */
function toComponent(r: Record<string, unknown>): LibraryComponent | string {
  const { slug, category, name } = r;
  const low = r.default_useful_life_low;
  const high = r.default_useful_life_high;
  const unit = r.default_unit_label;
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    return "the slug must be lower-case letters, numbers and hyphens only";
  }
  if (typeof name !== "string" || !HAS_WORD.test(name) || typeof category !== "string" || !HAS_WORD.test(category)) {
    return "the name and category each need at least one letter or number";
  }
  if (typeof low !== "number" || typeof high !== "number" || low < 1 || low > high || high > 100) {
    return "the useful life must run from low to high, between 1 and 100 years";
  }
  if (typeof unit !== "string" || !isUnitLabel(unit)) {
    return "the unit label must be per_unit, per_building or per_sq_ft";
  }
  return { slug, category, name, lifeLow: low, lifeHigh: high, unitLabel: unit };
}

/**
 * Validates component_library rows from the REST API. Anything malformed is
 * skipped, and onSkip hears why so the skip isn't silent.
 */
export function parseLibraryRows(data: unknown, onSkip?: (reason: string) => void): LibraryComponent[] {
  if (!Array.isArray(data)) return [];
  const items: LibraryComponent[] = [];
  for (const raw of data) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const result = toComponent(r);
    if (typeof result === "string") {
      onSkip?.(`Skipped component_library row ${JSON.stringify(r.slug)}: ${result}.`);
      continue;
    }
    items.push(result);
  }
  return items;
}

/**
 * The row's typical cost, null when it has none (all three cells blank), or why
 * it can't be used. Same rule as the database check in 0005_typical_costs.sql.
 */
function toTypicalCost(r: Record<string, unknown>, slug: string): TypicalCost | null | string {
  const low = r.typical_cost_low;
  const high = r.typical_cost_high;
  const per = r.typical_cost_per;
  if (low === null && high === null && per === null) return null;
  if (
    typeof low !== "number" ||
    typeof high !== "number" ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    low < 0 ||
    low > high ||
    high >= 1e9
  ) {
    return "the typical cost must run from low to high, from 0 to under 1 billion";
  }
  if (!isTypicalCostPer(per)) return "typical_cost_per must be apartment or sq_ft";
  return { slug, low, high, per };
}

/**
 * Validates typical costs from the REST API. Rows without one are left out, and
 * malformed ones are skipped with the reason passed to onSkip. A row with a bad
 * slug is left out quietly, since the library skips it already and says why.
 */
export function parseTypicalCostRows(data: unknown, onSkip?: (reason: string) => void): TypicalCost[] {
  if (!Array.isArray(data)) return [];
  const costs: TypicalCost[] = [];
  for (const raw of data) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.slug !== "string" || !SLUG_PATTERN.test(r.slug)) continue;
    const result = toTypicalCost(r, r.slug);
    if (typeof result === "string") {
      onSkip?.(`Skipped the typical cost of component_library row ${JSON.stringify(r.slug)}: ${result}.`);
      continue;
    }
    if (result) costs.push(result);
  }
  return costs;
}
