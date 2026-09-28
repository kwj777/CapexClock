import type { UnitLabel } from "@/lib/forecast";
import { supabaseEnv } from "@/lib/supabase/env";
import { COMPONENT_LIBRARY, type LibraryComponent } from "./components";

const UNIT_LABELS: readonly UnitLabel[] = ["per_unit", "per_building", "per_sq_ft"];

/**
 * Slugs become page addresses (/lifespan/<slug>). The database enforces the same
 * rule, and the same "not blank" rule for names and categories, so the table
 * editor refuses a row the site would skip (supabase/migrations/0003).
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
const NOT_BLANK = /\S/;

function isUnitLabel(value: string): value is UnitLabel {
  return (UNIT_LABELS as readonly string[]).includes(value);
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
  if (typeof name !== "string" || !NOT_BLANK.test(name) || typeof category !== "string" || !NOT_BLANK.test(category)) {
    return "the name and category can't be blank";
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
 * The component library as edited in the Supabase dashboard, refreshed hourly.
 * Falls back to the copy in components.ts when Supabase isn't configured or
 * can't be reached, so public pages always render.
 */
export async function getLibrary(): Promise<LibraryComponent[]> {
  const env = supabaseEnv();
  if (!env) return COMPONENT_LIBRARY;
  try {
    const res = await fetch(
      `${env.url}/rest/v1/component_library?select=slug,category,name,default_useful_life_low,default_useful_life_high,default_unit_label&order=sort_order`,
      { headers: { apikey: env.key }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return COMPONENT_LIBRARY;
    const items = parseLibraryRows(await res.json(), (reason) => console.warn(reason));
    return items.length > 0 ? items : COMPONENT_LIBRARY;
  } catch {
    return COMPONENT_LIBRARY;
  }
}
