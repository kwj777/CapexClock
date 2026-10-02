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

/**
 * Said once the list holds items already past end of life or due this year: they're
 * paid this year either way, so the difference comes from the items due in the next
 * 2 years. An emergency percent also adds its extra to the waiting side, so the
 * second variant says so. Both are drawn in one spot (one shown), so typing a percent
 * never moves the list. Empty when nothing is paid this year either way.
 * Awaiting Kevin: if the extra stops applying to items paid this year either way (see
 * emergencyPercent in src/lib/forecast/compare.ts), "Only the emergency extra differs."
 * is no longer true and that variant goes.
 */
export function eitherWayVariants(
  items: Pick<AtRiskItem, "endOfLifeYear">[],
  startYear: number,
  emergencyPercent: number,
): { text: string; shown: boolean }[] {
  const inYearOne = items.filter((i) => i.endOfLifeYear <= startYear).length;
  if (inYearOne === 0) return [];
  const extra = emergencyPercent > 0;
  if (inYearOne === items.length) {
    const either = `Everything here is past end of life or due in ${startYear}, so it's paid in ${startYear} either way.`;
    return [
      { text: either, shown: !extra },
      { text: `${either} Only the emergency extra differs.`, shown: extra },
    ];
  }
  const either = `Items past end of life or due in ${startYear} are paid in ${startYear} either way, so the difference comes from items due in the next 2 years`;
  return [
    { text: `${either}.`, shown: !extra },
    { text: `${either} and the emergency extra.`, shown: extra },
  ];
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

/** compare_viewed {items}: once per page view, the first time the panel opens with something in it. */
export function viewedEvent(opening: boolean, alreadySent: boolean, items: number): { items: number } | null {
  return opening && !alreadySent && items > 0 ? { items } : null;
}

/** What Apply did, kept so Undo can put the draft back. */
export interface AppliedChange {
  before: Draft;
  after: Draft;
  count: number;
}

/**
 * What the comparison remembers for the whole page view. The calculator keeps it,
 * not the panel, because the panel goes away whenever nothing is at risk (an install
 * year edited, say, or Clear) and comes back when something is again.
 */
export interface CompareState {
  open: boolean;
  /** What's typed in the emergency box. */
  percentText: string;
  /** Unticked rather than ticked, so an item that comes into the list starts ticked. */
  unticked: ReadonlySet<string>;
  applied: AppliedChange | null;
  /** compare_viewed has gone out in this page view. */
  viewed: boolean;
}

export const NEW_COMPARE_STATE: CompareState = {
  open: false,
  percentText: "",
  unticked: new Set(),
  applied: null,
  viewed: false,
};

/**
 * Opens or closes the panel, with the compare_viewed event to send, if any. It goes
 * out once per page view, however often the panel opens or the at-risk list empties
 * and fills again.
 */
export function togglePanel(
  state: CompareState,
  items: number,
): { state: CompareState; event: { items: number } | null } {
  const event = viewedEvent(!state.open, state.viewed, items);
  return { state: { ...state, open: !state.open, viewed: state.viewed || event !== null }, event };
}

/** Ticks or unticks one item in the panel's list. */
export function withTick(state: CompareState, id: string, ticked: boolean): CompareState {
  const unticked = new Set(state.unticked);
  if (ticked) unticked.delete(id);
  else unticked.add(id);
  return { ...state, unticked };
}

/** The draft after Apply or Undo, and what the panel says and focuses next. */
export interface CompareAction {
  draft: Draft;
  /** What Undo would put back, or null once there's nothing to undo. */
  applied: AppliedChange | null;
  /** For the live region. */
  message: string;
  /** The control that gets focus next. */
  focus: "undo" | "apply" | "toggle";
}

/**
 * Apply: turns on Replace this year for the chosen rows only. Focus goes to Undo,
 * which stands in for the items Apply moved. Null when nothing is chosen.
 */
export function applyChosen(draft: Draft, chosen: readonly string[]): CompareAction | null {
  if (chosen.length === 0) return null;
  const after = withReplaceNow(draft, new Set(chosen));
  return {
    draft: after,
    applied: { before: draft, after, count: chosen.length },
    message: `${appliedText(chosen.length)} The forecast above is updated.`,
    focus: "undo",
  };
}

/**
 * Undo is offered while the form is exactly as Apply left it, like the calculator's
 * own Undo, so any other edit, Clear or a reload takes it away.
 */
export function canUndoApply(applied: AppliedChange | null, draft: Draft): applied is AppliedChange {
  return (
    applied !== null &&
    applied.after.rows === draft.rows &&
    applied.after.unitCount === draft.unitCount &&
    applied.after.yearBuilt === draft.yearBuilt
  );
}

/**
 * Undo: puts the draft back as it was before Apply. Focus goes back to Apply, or
 * to the panel's button when the panel is closed. Null when there's nothing to undo.
 */
export function undoApplied(applied: AppliedChange | null, draft: Draft, panelOpen: boolean): CompareAction | null {
  if (!canUndoApply(applied, draft)) return null;
  return {
    draft: applied.before,
    applied: null,
    message: undoneText(applied.count),
    focus: panelOpen ? "apply" : "toggle",
  };
}

/**
 * Whether the control an Apply or Undo picked gets focus now, a render later, or not
 * at all. The calculator works out the forecast a moment after the draft changes, so
 * right after Undo the figures, and so Apply, can still be from before: Apply is
 * disabled until the forecast catches up. Focus waits for that instead of being lost.
 */
export function focusStep(target: { disabled: boolean } | null, forecastPending: boolean): "focus" | "wait" | "drop" {
  if (target && !target.disabled) return "focus";
  return forecastPending ? "wait" : "drop";
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
