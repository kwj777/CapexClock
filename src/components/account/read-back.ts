import { fetchAllRows } from "@/lib/properties/load";
import type { ReadBack } from "@/lib/properties/save";
import { createClient } from "@/lib/supabase/client";

/** Reads a property and its components from the database; null if that fails. */
export async function readBack(id: string): Promise<ReadBack | null> {
  const supabase = createClient();
  try {
    // The property (with its version) first, then its components. If another save
    // lands in between, the older version goes with the newer components, so the
    // next save is refused instead of overwriting that save.
    const { data: property, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
    if (error) return null;
    if (!property) return { property: null, components: [] };
    const components = await fetchAllRows((from, to) =>
      supabase
        .from("components")
        .select("*", { count: "exact" })
        .eq("property_id", id)
        .order("sort_order")
        .order("id")
        .range(from, to),
    );
    return { property, components };
  } catch {
    return null;
  }
}

/** True only when the browser has definitely lost its session (not when it's offline). */
export async function isSignedOut(): Promise<boolean> {
  const { data, error } = await createClient().auth.getSession();
  return !error && !data.session;
}
