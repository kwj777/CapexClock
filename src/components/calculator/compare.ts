import type { AtRiskItem, ComparisonFigures, ReplaceNowComparison } from "@/lib/forecast";
import { editRow, type Draft } from "./draft";
import { formatMoney, formatReserve } from "./format";

/** The highest "Emergency replacements cost __% more" the comparison takes. */
export const MAX_EMERGENCY_PERCENT = 500;

export const EMERGENCY_PERCENT_TEXT = `Enter a percent from 0 to ${MAX_EMERGENCY_PERCENT}, like 25.`;

/**
 * Reads the emergency box. Blank means no extra. Anything that isn't a percent
 * from 0 to MAX_EMERGENCY_PERCENT is an error, and the comparison leaves it out.
 */
export function parseEmergencyPercent(text: string): { percent: number; error: boolean } {
  const cleaned = text.replace(/\s/g, "").replace(/%$/, "");
  if (cleaned === "") return { percent: 0, error: false };
  // Plain decimals only, so "1e2" or "0x10" isn't read as a number nobody typed.
  const value = /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : NaN;
  if (!Number.isFinite(value) || value > MAX_EMERGENCY_PERCENT) return { percent: 0, error: true };
  return { percent: value, error: false };
}

/** Ticks "Replace this year" on the given rows, and only those. */
export function withReplaceNow(draft: Draft, ids: ReadonlySet<string>): Draft {
  return {
    ...draft,
    rows: draft.rows.map((r) =>
      ids.has(r.id) && r.scenario !== "replace_now" ? editRow(r, { scenario: "replace_now" }, draft.unitCount) : r,
    ),
  };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "Past due since 2011" or "Due 2027", as the at-risk list shows it. */
export function riskText(item: Pick<AtRiskItem, "status" | "endOfLifeYear">): string {
  return item.status === "overdue" ? `Past due since ${item.endOfLifeYear}` : `Due ${item.endOfLifeYear}`;
}

/**
 * The line under an item in the comparison's list: when it's due and, for an
 * install year that's an estimate, where that year came from.
 */
export function itemDetail(
  item: Pick<AtRiskItem, "status" | "endOfLifeYear" | "installYearIsEstimate">,
  installYear: number,
  guessed: boolean,
): string {
  const due = `${riskText(item)}.`;
  if (!item.installYearIsEstimate) return due;
  return guessed
    ? `${due} Install year ${installYear} is a guess.`
    : `${due} No install year, so year built (${installYear}) is used.`;
}

/**
 * The line above the figures. Every variant is drawn in the same spot (one
 * shown), so ticking items never moves the list under the pointer.
 */
export function leadVariants(chosen: number, items: number, startYear: number): { text: string; shown: boolean }[] {
  const all =
    items === 1 ? `If you replace the item below in ${startYear}:` : `If you replace all ${items} items below in ${startYear}:`;
  const some = `If you replace the ${chosen === 1 ? "ticked item" : `${chosen} ticked items`} in ${startYear}:`;
  const none = "Tick at least one item below to compare.";
  return [
    { text: all, shown: chosen === items && items > 0 },
    { text: some, shown: chosen > 0 && chosen < items },
    { text: none, shown: chosen === 0 },
  ];
}

/** "$12,000 if you wait", or "Same if you wait" when the two read the same on screen. */
export function ifYouWait(shown: string, waiting: string): string {
  return shown === waiting ? "Same if you wait" : `${waiting} if you wait`;
}

/** The change in the 10-year total, in whole dollars as the screen shows them. */
export function totalChange(asPlanned: number, replaceNow: number): { change: string; detail: string } {
  const difference = Math.round(replaceNow) - Math.round(asPlanned);
  if (difference === 0) return { change: "No change", detail: `${formatMoney(replaceNow)} either way` };
  return {
    change: `${formatMoney(Math.abs(difference))} ${difference > 0 ? "more" : "less"}`,
    detail: `${formatMoney(replaceNow)}, or ${formatMoney(asPlanned)} if you wait`,
  };
}

export const RESERVE_LOWER_TEXT = "The monthly amount is lower because these are paid now instead of saved for.";
export const RESERVE_SAME_TEXT = "The monthly amount stays the same.";
export const RESERVE_HIGHER_TEXT = "The monthly amount is higher.";

/**
 * What to say about the monthly reserve. "Lower" only when the amount shown is
 * lower: both round up to the dollar, so a few cents' difference is the same.
 */
export function reserveVariants(asPlanned: number, replaceNow: number): { text: string; shown: boolean }[] {
  const before = Math.ceil(asPlanned - 1e-6);
  const after = Math.ceil(replaceNow - 1e-6);
  return [
    { text: RESERVE_LOWER_TEXT, shown: after < before },
    { text: RESERVE_SAME_TEXT, shown: after === before },
    { text: RESERVE_HIGHER_TEXT, shown: after > before },
  ];
}

/** Per unit, per month on the replace-now side, e.g. "$92 per unit, or $105 if you wait". */
export function perUnitText(asPlanned: ComparisonFigures, replaceNow: ComparisonFigures): string | null {
  if (asPlanned.monthlyReservePerUnit === null || replaceNow.monthlyReservePerUnit === null) return null;
  const shown = formatReserve(replaceNow.monthlyReservePerUnit);
  const waiting = formatReserve(asPlanned.monthlyReservePerUnit);
  return shown === waiting ? `${shown} per unit, same if you wait` : `${shown} per unit, or ${waiting} if you wait`;
}

/** Said once the list holds items already past end of life or due this year. */
export function eitherWayText(items: Pick<AtRiskItem, "endOfLifeYear">[], startYear: number): string {
  const inYearOne = items.filter((i) => i.endOfLifeYear <= startYear).length;
  if (inYearOne === 0) return "";
  if (inYearOne === items.length) {
    return `Everything here is past end of life or due in ${startYear}, so it's paid in ${startYear} either way.`;
  }
  return `Items past end of life or due in ${startYear} are paid in ${startYear} either way.`;
}

/** Under the emergency box once it has a percent in it. */
export function emergencyNote(percent: number): string {
  const amount = percent.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `Here, waiting costs ${amount}% more for each item's next replacement. The forecast above doesn't include it.`;
}

export const EMERGENCY_HINT =
  "Optional. Use it if waiting until something breaks costs more, such as rush fees or water damage.";

export function applyLabel(chosen: number): string {
  return chosen === 0 ? "Apply" : `Apply to ${plural(chosen, "item")}`;
}

export function appliedText(count: number): string {
  return `Turned on Replace this year for ${plural(count, "item")}.`;
}

export function undoneText(count: number): string {
  return `Replace this year is off again for ${count === 1 ? "that item" : `those ${count} items`}.`;
}

/** For screen readers, once ticking items or the emergency box changes the figures. */
export function compareSummary(comparison: ReplaceNowComparison, startYear: number): string {
  const { asPlanned, replaceNow, chosen, items } = comparison;
  const lead = leadVariants(chosen.length, items.length, startYear).find((v) => v.shown)?.text ?? "";
  if (chosen.length === 0) return lead;
  const cash = formatMoney(replaceNow.neededNow);
  const monthly = formatReserve(replaceNow.monthlyReserve);
  const reserve = reserveVariants(asPlanned.monthlyReserve, replaceNow.monthlyReserve).find((v) => v.shown)?.text ?? "";
  return [
    lead,
    `Cash needed in ${startYear}: ${cash}, ${lowerFirst(ifYouWait(cash, formatMoney(asPlanned.neededNow)))}.`,
    `10-year total: ${lowerFirst(totalChange(asPlanned.total, replaceNow.total).change)}.`,
    `Monthly reserve: ${monthly}, ${lowerFirst(ifYouWait(monthly, formatReserve(asPlanned.monthlyReserve)))}.`,
    reserve,
  ].join(" ");
}
