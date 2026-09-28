import type { Draft } from "@/components/calculator/draft";

/**
 * Edits the property editor couldn't save (for example because the session ended),
 * kept in this browser so they survive signing in again.
 */
export interface UnsavedEdits {
  name: string;
  draft: Draft;
  /** The property version the edits started from; null for a new property. */
  baseUpdatedAt: string | null;
  keptAt: number;
}

const PREFIX = "capexclock:unsaved:v1:";
/** Older edits are dropped rather than sprung on the owner weeks later. */
export const KEEP_UNSAVED_MS = 7 * 24 * 60 * 60 * 1000;

/** Storage key part for a property, or for a property that hasn't been saved yet. */
export function unsavedKey(propertyId: string | undefined): string {
  return propertyId ?? "new";
}

export function parseUnsaved(raw: string | null, now: number): UnsavedEdits | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { name, draft, baseUpdatedAt, keptAt } = v as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !isDraft(draft) ||
      (baseUpdatedAt !== null && typeof baseUpdatedAt !== "string") ||
      typeof keptAt !== "number" ||
      now - keptAt > KEEP_UNSAVED_MS
    ) {
      return null;
    }
    return { name, draft, baseUpdatedAt, keptAt };
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is Draft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.unitCount === "string" &&
    typeof v.yearBuilt === "string" &&
    Array.isArray(v.rows) &&
    v.rows.every((r) => typeof r === "object" && r !== null && typeof (r as { id: unknown }).id === "string")
  );
}

export function loadUnsaved(key: string): UnsavedEdits | null {
  try {
    return parseUnsaved(window.localStorage.getItem(PREFIX + key), Date.now());
  } catch {
    return null;
  }
}

export function keepUnsaved(key: string, edits: Omit<UnsavedEdits, "keptAt">): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ ...edits, keptAt: Date.now() }));
  } catch {
    // Storage full or blocked: the edits stay on screen, they just won't survive a reload.
  }
}

export function clearUnsaved(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clear.
  }
}
