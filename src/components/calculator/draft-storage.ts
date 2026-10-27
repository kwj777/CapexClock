// Where the calculator keeps its draft in this browser. Browser storage and the
// clock stay here, on the app side; the draft's rules are in the landlord vertical.

import { EMPTY_DRAFT, importUndoFor, isDraft, upgradeDraft, type Draft } from "@/verticals/landlord";

export const STORAGE_KEY = "capexclock:calculator:v1";

export function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) return upgradeDraft(parsed, new Date().getFullYear());
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return EMPTY_DRAFT;
}

export function saveDraft(draft: Draft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked; the calculator still works without it.
  }
}

/**
 * The list before an import on the template page changed it, kept for this tab
 * only, so the calculator it opens can offer Undo as it does after its own imports.
 */
export const IMPORT_UNDO_KEY = "capexclock:calculator:import-undo:v1";

export function saveImportUndo(before: Draft, after: Draft): void {
  try {
    window.sessionStorage.setItem(IMPORT_UNDO_KEY, JSON.stringify({ before, after }));
  } catch {
    // Storage blocked: the import still works, without an undo.
  }
}

/** The kept list, if `current` is still what the import left; read without removing it. */
export function peekImportUndo(current: Draft, currentYear: number): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(IMPORT_UNDO_KEY);
    return raw ? importUndoFor(JSON.parse(raw), current, currentYear) : null;
  } catch {
    return null;
  }
}

export function clearImportUndo(): void {
  try {
    window.sessionStorage.removeItem(IMPORT_UNDO_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * What an import on the template page did ("Added 6 rows."), kept for this tab only,
 * so the calculator it opens can say so once.
 */
export const IMPORT_NOTICE_KEY = "capexclock:calculator:import-notice:v1";

export function saveImportNotice(said: string): void {
  try {
    window.sessionStorage.setItem(IMPORT_NOTICE_KEY, said);
    // The import is the latest news: an older lifespan-page arrival note isn't shown.
    window.sessionStorage.removeItem(ARRIVAL_KEY);
  } catch {
    // Storage blocked: the import still works, without the message.
  }
}

/** The kept message, read without removing it. */
export function peekImportNotice(): string | null {
  try {
    return window.sessionStorage.getItem(IMPORT_NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearImportNotice(): void {
  try {
    window.sessionStorage.removeItem(IMPORT_NOTICE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The row a lifespan page just added or updated, kept for this tab only, so the
 * calculator it opens can say the item arrived and point to it, once.
 */
export const ARRIVAL_KEY = "capexclock:calculator:arrival:v1";

export interface Arrival {
  rowId: string;
  /** How to name it in a sentence, e.g. "your gas furnace". */
  name: string;
}

export function saveArrival(arrival: Arrival): void {
  try {
    window.sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival));
    // The arrival is the latest news: an older import message isn't shown.
    window.sessionStorage.removeItem(IMPORT_NOTICE_KEY);
  } catch {
    // Storage blocked: the item still arrives, without the note.
  }
}

/** The arrival, if its row is in `current`; read without removing it. */
export function peekArrival(current: Draft): Arrival | null {
  try {
    const raw = window.sessionStorage.getItem(ARRIVAL_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const { rowId, name } = parsed as Record<string, unknown>;
    if (typeof rowId !== "string" || typeof name !== "string") return null;
    return current.rows.some((r) => r.id === rowId) ? { rowId, name } : null;
  } catch {
    return null;
  }
}

export function clearArrival(): void {
  try {
    window.sessionStorage.removeItem(ARRIVAL_KEY);
  } catch {
    // Nothing to clear.
  }
}
