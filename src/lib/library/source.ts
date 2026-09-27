import type { UnitLabel } from "@/lib/forecast";
import { supabaseEnv } from "@/lib/supabase/env";
import { COMPONENT_LIBRARY, type LibraryComponent } from "./components";

const UNIT_LABELS: readonly UnitLabel[] = ["per_unit", "per_building", "per_sq_ft"];

/** Validates component_library rows from the REST API; anything malformed is skipped. */
export function parseLibraryRows(data: unknown): LibraryComponent[] {
  if (!Array.isArray(data)) return [];
  const items: LibraryComponent[] = [];
  for (const raw of data) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const low = r.default_useful_life_low;
    const high = r.default_useful_life_high;
    const unit = r.default_unit_label;
    if (
      typeof r.slug !== "string" ||
      !/^[a-z0-9-]+$/.test(r.slug) ||
      typeof r.category !== "string" ||
      typeof r.name !== "string" ||
      typeof low !== "number" ||
      typeof high !== "number" ||
      low < 1 ||
      low > high ||
      high > 100 ||
      typeof unit !== "string" ||
      !(UNIT_LABELS as readonly string[]).includes(unit)
    ) {
      continue;
    }
    items.push({
      slug: r.slug,
      category: r.category,
      name: r.name,
      lifeLow: low,
      lifeHigh: high,
      unitLabel: unit as UnitLabel,
    });
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
    const items = parseLibraryRows(await res.json());
    return items.length > 0 ? items : COMPONENT_LIBRARY;
  } catch {
    return COMPONENT_LIBRARY;
  }
}
