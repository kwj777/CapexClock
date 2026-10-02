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

/** Shown in place of "Saved" when the database dropped condition, notes or "guess" flags. */
export const DETAILS_NOT_SAVED_TEXT = "Your database needs update 0004. Condition and notes weren't saved.";

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
 * How what the database holds compares with what was just saved:
 * - "same": exactly what was sent.
 * - "without_details": the same, except some condition, notes or "guess" flags. A database
 *   without update 0004 saves everything else and drops those without an error.
 * - "different": another save landed in between, so the editor can't trust its copy.
 */
export type SavedMatch = "same" | "without_details" | "different";

export function compareSaved(
  sent: Pick<SaveInput, "property" | "components">,
  property: Pick<PropertyRow, "name" | "unit_count" | "year_built">,
  components: ComponentRow[],
): SavedMatch {
  if (
    property.name !== sent.property.name ||
    property.unit_count !== sent.property.unit_count ||
    property.year_built !== sent.property.year_built ||
    components.length !== sent.components.length
  ) {
    return "different";
  }
  const rows = [...components].sort((a, b) => a.sort_order - b.sort_order);
  const sameRows = rows.every((row, i) => {
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
  if (!sameRows) return "different";
  const sameDetails = rows.every((row, i) => {
    const c = sent.components[i];
    return (
      row.condition === c.condition &&
      (row.notes ?? null) === c.notes &&
      // Missing before update 0004, which reads as not a guess.
      (row.install_year_is_estimate ?? false) === c.install_year_is_estimate
    );
  });
  return sameDetails ? "same" : "without_details";
}

/** True when a save sends any condition, notes or "guess" flag worth checking for afterwards. */
export function sendsDetails(input: Pick<SaveInput, "components">): boolean {
  return input.components.some((c) => c.condition !== null || c.notes !== null || c.install_year_is_estimate);
}

/**
 * True when rows read back come from a database that can't store condition, notes or
 * the "guess" flag yet (update 0004 hasn't run), so their absence isn't someone
 * else's save. Their column is missing from every row then.
 */
export function lacksUpdate0004(components: ComponentRow[]): boolean {
  return components.some((c) => c.install_year_is_estimate === undefined);
}

/**
 * True when two versions of a property's edits would save exactly the same thing,
 * row ids aside, and neither has anything left to fix. Kept edits that match what's
 * already saved have nothing to bring back.
 */
export function sameSave(a: SaveInput, b: SaveInput): boolean {
  if (Object.keys(a.problems).length > 0 || Object.keys(b.problems).length > 0) return false;
  const content = (input: SaveInput) =>
    JSON.stringify([input.property, input.components], (key, value: unknown) => (key === "id" ? undefined : value));
  return content(a) === content(b);
}

/** A property and its components as read back from the database; `property` is null when it's gone. */
export interface ReadBack {
  property: PropertyRow | null;
  components: ComponentRow[];
}

/**
 * When the last save couldn't read back its new version, the next save checks the
 * database first. It gets the database's version only if the property still holds
 * exactly what was last saved; otherwise it says why it can't go ahead. `back` is
 * null when the read failed.
 */
export function versionFromReadBack(
  lastSaved: Pick<SaveInput, "property" | "components">,
  back: ReadBack | null,
): { updatedAt: string } | { failure: "network" | "deleted" | "conflict" } {
  if (!back) return { failure: "network" };
  if (!back.property) return { failure: "deleted" };
  const match = compareSaved(lastSaved, back.property, back.components);
  // Details a database without update 0004 dropped don't mean someone else saved.
  if (match === "different" || (match === "without_details" && !lacksUpdate0004(back.components))) {
    return { failure: "conflict" };
  }
  return { updatedAt: back.property.updated_at };
}
