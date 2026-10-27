// Where the reserve calculator's two tabs keep what was typed in this browser,
// so a reload, Back, or a trip to the CapEx calculator doesn't empty them.
// Nothing here is sent anywhere.

import { useSyncExternalStore } from "react";

export const QUICK_STORAGE_KEY = "capexclock:reserve:quick:v1";
export const EXPENSES_STORAGE_KEY = "capexclock:reserve:expenses:v1";

export interface SavedQuick {
  units: string;
  yearBuilt: string;
  /** Slugs of the ticked systems. */
  ticked: string[];
}

export interface SavedExpenseRow {
  name: string;
  cost: string;
  years: string;
}

export interface SavedExpenses {
  rows: SavedExpenseRow[];
  balance: string;
  units: string;
}

const isString = (v: unknown): v is string => typeof v === "string";
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function parseSavedQuick(raw: string | null): SavedQuick | null {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(v) || !isString(v.units) || !isString(v.yearBuilt)) return null;
    if (!Array.isArray(v.ticked) || !v.ticked.every(isString)) return null;
    return { units: v.units, yearBuilt: v.yearBuilt, ticked: v.ticked };
  } catch {
    return null;
  }
}

export function parseSavedExpenses(raw: string | null): SavedExpenses | null {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isObject(v) || !isString(v.balance) || !isString(v.units) || !Array.isArray(v.rows)) return null;
    const rows = v.rows.filter(
      (r): r is SavedExpenseRow => isObject(r) && isString(r.name) && isString(r.cost) && isString(r.years),
    );
    if (rows.length === 0) return null;
    return { rows: rows.map(({ name, cost, years }) => ({ name, cost, years })), balance: v.balance, units: v.units };
  } catch {
    return null;
  }
}

/** Reads a saved tab, or null when there's none or storage is blocked. */
export function loadSaved<T>(key: string, parse: (raw: string | null) => T | null): T | null {
  try {
    return parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Keeps a tab's fields, or forgets them when `value` is null (nothing typed). */
export function keepSaved(key: string, value: object | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the calculator still works without it.
  }
}

const subscribeNothing = () => () => {};

/**
 * False while the page is built and hydrated, then true: when browser storage
 * can be read without the first render differing from the built page.
 */
export function useInBrowser(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
