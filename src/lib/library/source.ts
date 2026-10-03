import { supabaseEnv } from "@/lib/supabase/env";
import {
  COMPONENT_LIBRARY,
  parseLibraryRows,
  parseTypicalCostRows,
  TYPICAL_COSTS,
  type LibraryComponent,
  type TypicalCost,
} from "@/verticals/landlord";

/**
 * The component library as edited in the Supabase dashboard, refreshed hourly.
 * Falls back to the built-in copy (the landlord library) when Supabase isn't configured or
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

/**
 * Typical costs for the quick estimate and the calculator's hints, refreshed
 * hourly. A separate request from getLibrary, with its own fallback to the
 * built-in copy: before update 0005 runs the columns don't exist and this
 * request fails, which must never cost the lifespans edited in the dashboard.
 * The fallback is also used when the library has no rows (as getLibrary does),
 * but not when every row's cost has been blanked: that takes them all out.
 */
export async function getTypicalCosts(): Promise<TypicalCost[]> {
  const env = supabaseEnv();
  if (!env) return TYPICAL_COSTS;
  try {
    const res = await fetch(
      `${env.url}/rest/v1/component_library?select=slug,typical_cost_low,typical_cost_high,typical_cost_per&order=sort_order`,
      { headers: { apikey: env.key }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return TYPICAL_COSTS;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return TYPICAL_COSTS;
    return parseTypicalCostRows(data, (reason) => console.warn(reason));
  } catch {
    return TYPICAL_COSTS;
  }
}
