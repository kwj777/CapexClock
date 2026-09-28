import type { Draft } from "@/components/calculator/draft";

/**
 * Edits the property editor hasn't saved yet, kept in this browser so they survive
 * leaving the page (Back, a lost session, an error page) and signing in again.
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

type KeyStore = Pick<Storage, "length" | "key">;

/**
 * Storage key part for a property, or for a property that hasn't been saved yet.
 * It includes the account, so edits only come back for the person who made them.
 * Null without an account, and then nothing is kept.
 */
export function unsavedKey(userId: string | null, propertyId: string | undefined): string | null {
  return userId ? `${userId}:${propertyId ?? "new"}` : null;
}

function storedKeys(storage: KeyStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
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

/** Ids of the account's saved properties that have edits kept in `storage`. */
export function keptPropertyIds(storage: KeyStore & Pick<Storage, "getItem">, userId: string, now: number): string[] {
  const prefix = `${PREFIX}${userId}:`;
  return storedKeys(storage)
    .filter((key) => key.startsWith(prefix) && key !== `${prefix}new`)
    .filter((key) => parseUnsaved(storage.getItem(key), now) !== null)
    .map((key) => key.slice(prefix.length))
    .sort();
}

/** Drops every account's kept edits from `storage`, so the next person on this browser can't see them. */
export function clearAllUnsaved(storage: KeyStore & Pick<Storage, "removeItem">): void {
  for (const key of storedKeys(storage)) storage.removeItem(key);
}

export function loadUnsaved(key: string | null): UnsavedEdits | null {
  if (!key) return null;
  try {
    return parseUnsaved(window.localStorage.getItem(PREFIX + key), Date.now());
  } catch {
    return null;
  }
}

export function keepUnsaved(key: string | null, edits: Omit<UnsavedEdits, "keptAt">): void {
  if (!key) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ ...edits, keptAt: Date.now() }));
  } catch {
    // Storage full or blocked: the edits stay on screen, they just won't survive leaving.
  }
}

export function clearUnsaved(key: string | null): void {
  if (!key) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clear.
  }
}
