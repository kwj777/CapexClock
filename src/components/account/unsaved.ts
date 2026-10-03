import { toSaveInput } from "@/lib/properties/convert";
import { sameSave } from "@/lib/properties/save";
import { cleanDetails, type Draft } from "@/verticals/landlord";

/**
 * Edits the property editor hasn't saved yet, kept in this browser so they survive
 * leaving the page (Back, a lost session, an error page) and signing in again.
 */
export interface UnsavedEdits {
  name: string;
  draft: Draft;
  /** The property version the edits started from; null for a new property. */
  baseUpdatedAt: string | null;
  /**
   * For a property started from the calculator: that calculator work (as stored) when
   * it was brought in, so these edits never come back over newer calculator work.
   */
  calculator?: string;
  keptAt: number;
}

const PREFIX = "capexclock:unsaved:v1:";
/** Older edits are dropped rather than sprung on the owner weeks later. */
export const KEEP_UNSAVED_MS = 7 * 24 * 60 * 60 * 1000;

type KeyStore = Pick<Storage, "length" | "key">;

// Keys for properties that haven't been saved yet: added by hand, or from the calculator.
const NEW = "new";
const FROM_CALCULATOR = "calculator";

/**
 * Storage key part for a property, or for a property that hasn't been saved yet.
 * It includes the account, so edits only come back for the person who made them.
 * Null without an account, and then nothing is kept.
 */
export function unsavedKey(
  userId: string | null,
  propertyId: string | undefined,
  fromCalculator = false,
): string | null {
  if (!userId) return null;
  return `${userId}:${propertyId ?? (fromCalculator ? FROM_CALCULATOR : NEW)}`;
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
    const { name, draft, baseUpdatedAt, calculator, keptAt } = v as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !isDraft(draft) ||
      (baseUpdatedAt !== null && typeof baseUpdatedAt !== "string") ||
      (calculator !== undefined && typeof calculator !== "string") ||
      typeof keptAt !== "number" ||
      now - keptAt > KEEP_UNSAVED_MS
    ) {
      return null;
    }
    return {
      name,
      draft: { ...draft, rows: draft.rows.map(cleanDetails) },
      baseUpdatedAt,
      ...(calculator === undefined ? {} : { calculator }),
      keptAt,
    };
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
    .filter((key) => key.startsWith(prefix))
    .filter((key) => parseUnsaved(storage.getItem(key), now) !== null)
    .map((key) => key.slice(prefix.length))
    .filter((id) => id !== NEW && id !== FROM_CALCULATOR)
    .sort();
}

/**
 * True when kept edits hold nothing the page doesn't already show: the same name and
 * draft, or (row ids and number formatting aside) the same thing to save. That's the
 * case when a save finished after the owner left, or an import was left untouched.
 */
export function nothingToRestore(
  kept: Pick<UnsavedEdits, "name" | "draft">,
  name: string,
  draft: Draft,
  currentYear: number,
): boolean {
  if (kept.name === name && JSON.stringify(kept.draft) === JSON.stringify(draft)) return true;
  return sameSave(toSaveInput(kept.name, kept.draft, currentYear), toSaveInput(name, draft, currentYear));
}

/** True when a storage event says another tab removed the copy kept under `key` (or cleared storage). */
export function wasDropped(event: Pick<StorageEvent, "key" | "newValue">, key: string | null): boolean {
  return key !== null && event.newValue === null && (event.key === null || event.key === PREFIX + key);
}

/**
 * True for a link that opens another app (email, a phone call or a text), so this
 * page stays where it is. Chrome still fires beforeunload for one, which would ask
 * "Leave site?" though nothing is lost.
 */
export function opensAnotherApp(href: string): boolean {
  try {
    return ["mailto:", "tel:", "sms:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
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
