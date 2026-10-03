import type { LibraryComponent } from "@/verticals/landlord";
import type { NameMatcher } from "./names";
import { openSheet, startingChoices, type OpenedSheet } from "./open";
import { buildPreview } from "./preview";
import type { FailReason } from "./read";
import { tooWide, type Tab } from "./xlsx";

/** A tab opened, or why it couldn't be. */
export type OpenedTab = OpenedSheet | FailReason;

/** Opens every tab, so the picker can say which ones have headings. */
export function openTabs(tabs: readonly Tab[], match: NameMatcher, currentYear: number): OpenedTab[] {
  return tabs.map((t) => (tooWide(t) ? "too_big" : openSheet(t.grid, match, currentYear)));
}

/**
 * How many rows each tab would import as it opens, every building included: the
 * number its preview gives, so total rows and other skipped rows aren't counted.
 * Null for a tab that can't be read.
 */
export function tabRowCounts(
  opened: readonly OpenedTab[],
  library: readonly LibraryComponent[],
  match: NameMatcher,
  currentYear: number,
): (number | null)[] {
  return opened.map((tab) => {
    if (typeof tab === "string") return null;
    const choices = { ...startingChoices(tab, currentYear), building: null };
    return buildPreview(tab.sheet, choices, library, match, currentYear).counts.rows;
  });
}

/** "24 rows", "hidden, 3 rows" or why a tab can't be read, for the tab picker. */
export function tabNote(tab: Tab, opened: OpenedTab, rows: number | null): string {
  let note: string;
  if (typeof opened === "string") {
    if (tab.grid.length === 0) note = "empty";
    else if (opened === "no_header") note = "no headings found";
    else if (opened === "too_big") note = "too big";
    else if (opened === "forecast_file") note = "a forecast download";
    else note = "can't be read";
  } else {
    const n = rows ?? 0;
    note = `${n.toLocaleString("en-US")} ${n === 1 ? "row" : "rows"}`;
  }
  return tab.hidden ? `hidden, ${note}` : note;
}

/**
 * The tabs chosen to start with: every one that can be read, except hidden ones,
 * which are often lookups or working sheets. Hidden tabs are chosen only when
 * no other tab can be read.
 */
export function startingTabs(tabs: readonly Tab[], opened: readonly OpenedTab[]): number[] {
  const usable = opened.flatMap((t, i) => (typeof t === "object" ? [i] : []));
  const shown = usable.filter((i) => !tabs[i]?.hidden);
  return shown.length > 0 ? shown : usable;
}
