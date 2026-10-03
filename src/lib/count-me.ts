// Kevin's own browsers stay out of the numbers. Opening any page with
// ?count-me=off marks this browser, and from then on PostHog isn't even loaded
// here; ?count-me=on undoes it. Each browser is marked on its own.

export const COUNT_ME_KEY = "capexclock:count-me:v1";
export const COUNT_ME_PARAM = "count-me";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** What ?count-me= asks for, or null when the page doesn't say. */
export function countMeRequest(search: string): "off" | "on" | null {
  const value = new URLSearchParams(search).get(COUNT_ME_PARAM)?.trim().toLowerCase();
  return value === "off" || value === "on" ? value : null;
}

/** The address without ?count-me=, so it isn't shared or recorded by mistake. */
export function withoutCountMe(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(COUNT_ME_PARAM);
  return url.toString();
}

/**
 * Applies ?count-me= from the address (then drops it from the address bar) and
 * says whether this browser is counted. Storage that's blocked counts it.
 */
export function applyCountMe(location: Pick<Location, "search" | "href">, storage: () => Store, replaceUrl: (href: string) => void): boolean {
  const request = countMeRequest(location.search);
  try {
    const store = storage();
    if (request === "off") store.setItem(COUNT_ME_KEY, "off");
    if (request === "on") store.removeItem(COUNT_ME_KEY);
    if (request) replaceUrl(withoutCountMe(location.href));
    return store.getItem(COUNT_ME_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Whether this browser was marked not to count, for the footer note. */
export function isNotCounted(storage: () => Pick<Storage, "getItem">): boolean {
  try {
    return storage().getItem(COUNT_ME_KEY) === "off";
  } catch {
    return false;
  }
}

/** Tells the footer note when this browser is marked or unmarked. */
export const COUNT_ME_EVENT = "capexclock:count-me";
