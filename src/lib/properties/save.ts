import type { Draft } from "@/components/calculator/draft";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import type { SaveInput } from "./convert";

/** Why a save didn't go through, so the editor can say what to do about it. */
export type SaveFailure = "signed_out" | "conflict" | "deleted" | "rejected" | "network";

export const SAVE_FAILURE_TEXT: Record<SaveFailure, string> = {
  signed_out:
    "You've been signed out, so this wasn't saved. Your changes are kept on this device. Sign in again to save them.",
  conflict: "This property was changed in another tab or device. Reload to see the latest.",
  deleted: "This property was deleted, maybe in another tab. You can save your changes as a new property.",
  rejected: "Couldn't save. One of the values isn't allowed. Check the numbers and names, then try again.",
  network: "Couldn't save. Check your connection and try again.",
};

/** PostgREST's answer when a function signature doesn't exist (migration 0002 not run yet). */
export const FUNCTION_NOT_FOUND = "PGRST202";

/** Sorts a failed save_property call by its HTTP status and Postgres or PostgREST code. */
export function saveFailure(error: { code?: string } | null, status: number): SaveFailure {
  const code = error?.code ?? "";
  // No usable session: the request went out signed out, or with an expired token.
  if (status === 401 || code.startsWith("PGRST30")) return "signed_out";
  // Raised by save_property (0002) when the property was saved since it was loaded.
  if (code === "PT409") return "conflict";
  if (code === "P0002") return "deleted";
  // Check constraints, bad numbers and permission refusals: retrying won't help.
  if (code.startsWith("22") || code.startsWith("23") || code === "42501") return "rejected";
  return "network";
}

/**
 * After a save, gives each row that was sent the id the database stored it under,
 * leaving rows added or removed since then as they are. `savedIds[i]` is the id of
 * `sent.rows[i]`.
 */
export function withSavedIds(draft: Draft, sent: Draft, savedIds: string[]): Draft {
  const ids = new Map(sent.rows.map((row, i) => [row.id, savedIds[i]]));
  let changed = false;
  const rows = draft.rows.map((row) => {
    const id = ids.get(row.id);
    if (!id || id === row.id) return row;
    changed = true;
    return { ...row, id };
  });
  return changed ? { ...draft, rows } : draft;
}

/**
 * True when the database holds exactly what was just saved. Anything else means
 * another save landed in between, so the editor can't trust its copy.
 */
export function matchesSaved(
  sent: Pick<SaveInput, "property" | "components">,
  property: Pick<PropertyRow, "name" | "unit_count" | "year_built">,
  components: ComponentRow[],
): boolean {
  if (
    property.name !== sent.property.name ||
    property.unit_count !== sent.property.unit_count ||
    property.year_built !== sent.property.year_built ||
    components.length !== sent.components.length
  ) {
    return false;
  }
  const rows = [...components].sort((a, b) => a.sort_order - b.sort_order);
  return rows.every((row, i) => {
    const c = sent.components[i];
    return (
      row.sort_order === c.sort_order &&
      row.name === c.name &&
      row.category === c.category &&
      row.library_slug === c.library_slug &&
      Number(row.quantity) === c.quantity &&
      row.unit_label === c.unit_label &&
      row.install_year === c.install_year &&
      row.useful_life_years === c.useful_life_years &&
      (row.replacement_cost_each === null ? null : Number(row.replacement_cost_each)) ===
        c.replacement_cost_each &&
      row.scenario === c.scenario
    );
  });
}
