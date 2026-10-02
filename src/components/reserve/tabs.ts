/** The reserve calculator's tabs, in order. */
export const RESERVE_TABS = ["quick", "expenses"] as const;
export type ReserveTab = (typeof RESERVE_TABS)[number];

export const TAB_LABELS: Record<ReserveTab, string> = {
  quick: "Quick estimate",
  expenses: "List your expenses",
};

/** The query parameter that remembers the tab: ?tab=expenses. The quick estimate needs none. */
export const TAB_PARAM = "tab";

/** The tab a query string asks for: the quick estimate unless it says expenses. */
export function tabFromSearch(search: string): ReserveTab {
  return new URLSearchParams(search).get(TAB_PARAM) === "expenses" ? "expenses" : "quick";
}

/** The page's address with a tab chosen, keeping any other query and the hash. */
export function tabHref(location: Pick<Location, "pathname" | "search" | "hash">, tab: ReserveTab): string {
  const params = new URLSearchParams(location.search);
  if (tab === "quick") params.delete(TAB_PARAM);
  else params.set(TAB_PARAM, tab);
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}

/**
 * The tab a key moves to, as in the WAI-ARIA tabs pattern: left and right arrows
 * go to the previous and next tab (wrapping around), Home and End to the first
 * and last. Null for any other key.
 */
export function tabAfterKey(current: ReserveTab, key: string): ReserveTab | null {
  const i = RESERVE_TABS.indexOf(current);
  const last = RESERVE_TABS.length - 1;
  switch (key) {
    case "ArrowRight":
      return RESERVE_TABS[i === last ? 0 : i + 1];
    case "ArrowLeft":
      return RESERVE_TABS[i === 0 ? last : i - 1];
    case "Home":
      return RESERVE_TABS[0];
    case "End":
      return RESERVE_TABS[last];
    default:
      return null;
  }
}
