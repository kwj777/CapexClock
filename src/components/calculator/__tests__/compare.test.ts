import { compareReplaceNow, computeForecast, type ReplaceNowComparison } from "@/lib/forecast";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import {
  applyChosen,
  applyLabel,
  appliedText,
  canUndoApply,
  compareSummary,
  EMERGENCY_PERCENT_TEXT,
  emergencyNote,
  eitherWayVariants,
  focusStep,
  ifYouWait,
  itemDetail,
  leadVariants,
  NEW_COMPARE_STATE,
  parseEmergencyPercent,
  perUnitText,
  RESERVE_HIGHER_TEXT,
  RESERVE_LOWER_TEXT,
  RESERVE_SAME_TEXT,
  reserveVariants,
  riskText,
  togglePanel,
  totalChange,
  undoApplied,
  undoneText,
  viewedEvent,
  withReplaceNow,
  withTick,
} from "../compare";
import { EMPTY_DRAFT, editRow, exampleDraft, rowFromLibrary, toComponents, type Draft } from "../draft";

const shown = (variants: { text: string; shown: boolean }[]) => variants.filter((v) => v.shown).map((v) => v.text);

describe("the emergency box", () => {
  it("is optional: blank means no extra", () => {
    expect(parseEmergencyPercent("")).toEqual({ percent: 0, error: false });
    expect(parseEmergencyPercent("   ")).toEqual({ percent: 0, error: false });
  });

  it("reads a plain percent, with or without the sign and spaces", () => {
    expect(parseEmergencyPercent("20")).toEqual({ percent: 20, error: false });
    expect(parseEmergencyPercent(" 12.5 % ")).toEqual({ percent: 12.5, error: false });
    expect(parseEmergencyPercent("0")).toEqual({ percent: 0, error: false });
    expect(parseEmergencyPercent("500")).toEqual({ percent: 500, error: false });
    expect(parseEmergencyPercent(".5")).toEqual({ percent: 0.5, error: false });
  });

  it("flags anything else instead of guessing, and the comparison leaves it out", () => {
    for (const text of ["-5", "abc", "501", "$20", "20%%", "1e2", "0x10", "1,000", "."]) {
      expect(parseEmergencyPercent(text)).toEqual({ percent: 0, error: true });
    }
    expect(EMERGENCY_PERCENT_TEXT).toBe("Enter a percent from 0 to 500, like 25.");
  });

  it("explains what the percent does once there is one", () => {
    expect(emergencyNote(20)).toBe(
      "Here, waiting costs 20% more for each item's next replacement. The forecast above doesn't include it.",
    );
    expect(emergencyNote(12.5)).toContain("12.5%");
  });
});

describe("applying the comparison", () => {
  const draft = exampleDraft();
  const [roof, furnace, heater] = draft.rows;

  it("turns on Replace this year for the chosen rows only", () => {
    const next = withReplaceNow(draft, new Set([heater.id, furnace.id]));
    expect(next.rows.map((r) => r.scenario)).toEqual([
      "run_to_failure",
      "replace_now",
      "replace_now",
      "run_to_failure",
      "run_to_failure",
      "run_to_failure",
    ]);
    // Everything else about the rows stays as it was.
    expect(next.rows[0]).toBe(roof);
    expect({ ...next.rows[2], scenario: heater.scenario }).toEqual(heater);
    expect(next.unitCount).toBe(draft.unitCount);
  });

  it("doesn't change the draft it was given, so Undo can put it back", () => {
    const copy = structuredClone(draft);
    withReplaceNow(draft, new Set(draft.rows.map((r) => r.id)));
    expect(draft).toEqual(copy);
  });

  it("gives the forecast the comparison promised", () => {
    const start = 2026;
    const { components } = toComponents(draft, start);
    const comparison = compareReplaceNow({ startYear: start, unitCount: 12, components });
    const applied = withReplaceNow(draft, new Set(comparison.chosen));
    const after = computeForecast({ startYear: start, unitCount: 12, components: toComponents(applied, start).components });
    expect(after.neededNow).toBe(comparison.replaceNow.neededNow);
    expect(after.total).toBe(comparison.replaceNow.total);
    expect(after.monthlyReserve).toBe(comparison.replaceNow.monthlyReserve);
    // Applied rows aren't offered again.
    expect(compareReplaceNow({ startYear: start, unitCount: 12, components: toComponents(applied, start).components }).items).toEqual([]);
  });

  it("lists the example's at-risk rows, with the blank install year to check", () => {
    const { components } = toComponents(draft, 2026);
    const { items } = compareReplaceNow({ startYear: 2026, unitCount: 12, components });
    expect(items.map((i) => [i.name, i.installYearIsEstimate])).toEqual([
      ["Refrigerator", true],
      ["Tank water heater", false],
      ["Parking lot seal coat", false],
      ["Carpet", false],
    ]);
  });

  it("says what Apply did and what Undo did", () => {
    expect(applyLabel(0)).toBe("Apply");
    expect(applyLabel(1)).toBe("Apply to 1 item");
    expect(applyLabel(4)).toBe("Apply to 4 items");
    expect(appliedText(1)).toBe("Turned on Replace this year for 1 item.");
    expect(appliedText(3)).toBe("Turned on Replace this year for 3 items.");
    expect(undoneText(1)).toBe("Replace this year is off again for that item.");
    expect(undoneText(3)).toBe("Replace this year is off again for those 3 items.");
  });
});

describe("Apply and Undo in the panel", () => {
  const draft = exampleDraft();
  const { components } = toComponents(draft, 2026);
  const { chosen } = compareReplaceNow({ startYear: 2026, unitCount: 12, components });

  it("sends compare_viewed once, the first time the panel opens with items in it", () => {
    expect(viewedEvent(true, false, 4)).toEqual({ items: 4 });
    // Closing it, opening it again, or opening it with nothing to compare sends nothing.
    expect(viewedEvent(false, true, 4)).toBeNull();
    expect(viewedEvent(true, true, 4)).toBeNull();
    expect(viewedEvent(true, false, 0)).toBeNull();
  });

  it("keeps compare_viewed to once per page view as the panel opens and closes", () => {
    const first = togglePanel(NEW_COMPARE_STATE, 4);
    expect(first.event).toEqual({ items: 4 });
    expect(first.state).toMatchObject({ open: true, viewed: true });
    const closed = togglePanel(first.state, 4);
    expect(closed.event).toBeNull();
    expect(closed.state).toMatchObject({ open: false, viewed: true });
    // The calculator keeps this state while the at-risk list empties and fills
    // again, so opening it once more, with other items, sends nothing.
    const again = togglePanel(closed.state, 1);
    expect(again.event).toBeNull();
    expect(again.state.open).toBe(true);
  });

  it("sends compare_viewed on a later open if the first had nothing in it", () => {
    const empty = togglePanel(NEW_COMPARE_STATE, 0);
    expect(empty.event).toBeNull();
    expect(empty.state.viewed).toBe(false);
    const later = togglePanel(togglePanel(empty.state, 0).state, 2);
    expect(later.event).toEqual({ items: 2 });
  });

  it("opens and closes without touching the ticks, the emergency box or Undo", () => {
    const { applied } = applyChosen(draft, chosen)!;
    const state = { ...NEW_COMPARE_STATE, percentText: "20", unticked: new Set(["a"]), applied };
    const { state: next } = togglePanel(state, 4);
    expect(next.percentText).toBe("20");
    expect(next.unticked).toBe(state.unticked);
    expect(next.applied).toBe(applied);
  });

  it("ticks and unticks one item at a time", () => {
    const off = withTick(NEW_COMPARE_STATE, "a", false);
    expect([...off.unticked]).toEqual(["a"]);
    expect(NEW_COMPARE_STATE.unticked.size).toBe(0);
    expect([...withTick(withTick(off, "b", false), "a", true).unticked]).toEqual(["b"]);
  });

  it("applies the chosen rows, says so and moves focus to Undo", () => {
    const action = applyChosen(draft, chosen)!;
    expect(action.draft).toEqual(withReplaceNow(draft, new Set(chosen)));
    expect(action.applied).toEqual({ before: draft, after: action.draft, count: 4 });
    expect(action.message).toBe("Turned on Replace this year for 4 items. The forecast above is updated.");
    expect(action.focus).toBe("undo");
    expect(applyChosen(draft, [])).toBeNull();
  });

  it("offers Undo only while the form is as Apply left it", () => {
    const { draft: after, applied } = applyChosen(draft, chosen)!;
    expect(canUndoApply(applied, after)).toBe(true);
    expect(canUndoApply(null, after)).toBe(false);
    // Any other edit ends it.
    const edited = { ...after, rows: after.rows.map((r, i) => (i === 0 ? editRow(r, { name: "Roof" }, after.unitCount) : r)) };
    expect(canUndoApply(applied, edited)).toBe(false);
    expect(canUndoApply(applied, { ...after, unitCount: "13" })).toBe(false);
    expect(canUndoApply(applied, { ...after, yearBuilt: "1990" })).toBe(false);
    expect(canUndoApply(applied, EMPTY_DRAFT)).toBe(false);
    // Sending forecast_generated doesn't change the form, so Undo stays.
    expect(canUndoApply(applied, { ...after, forecastTracked: true })).toBe(true);
    // A reload starts with nothing to undo, even though the rows read the same.
    expect(canUndoApply(applied, structuredClone(after))).toBe(false);
  });

  it("puts the draft back, says so and returns focus to Apply, or to the button when closed", () => {
    const { draft: after, applied } = applyChosen(draft, chosen.slice(0, 1))!;
    const undone = undoApplied(applied, after, true)!;
    expect(undone.draft).toBe(draft);
    expect(undone.applied).toBeNull();
    expect(undone.message).toBe("Replace this year is off again for that item.");
    expect(undone.focus).toBe("apply");
    expect(undoApplied(applied, after, false)!.focus).toBe("toggle");
    expect(undoApplied(applied, { ...after, unitCount: "13" }, true)).toBeNull();
    expect(undoApplied(null, after, true)).toBeNull();
  });
});

describe("focus after Apply or Undo", () => {
  it("moves to a control that can take it", () => {
    expect(focusStep({ disabled: false }, false)).toBe("focus");
    expect(focusStep({ disabled: false }, true)).toBe("focus");
  });

  it("waits while Apply is still disabled from before Undo and the forecast hasn't caught up", () => {
    expect(focusStep({ disabled: true }, true)).toBe("wait");
    expect(focusStep(null, true)).toBe("wait");
  });

  it("gives up once the forecast has caught up, so it never jumps there later", () => {
    expect(focusStep({ disabled: true }, false)).toBe("drop");
    expect(focusStep(null, false)).toBe("drop");
  });
});

describe("the comparison's wording", () => {
  it("names when each item is due, and where an estimated install year came from", () => {
    const overdue = { status: "overdue" as const, endOfLifeYear: 2011, installYearIsEstimate: false };
    const soon = { status: "due_soon" as const, endOfLifeYear: 2028, installYearIsEstimate: false };
    expect(riskText(overdue)).toBe("Past due since 2011");
    expect(riskText(soon)).toBe("Due 2028");
    expect(itemDetail(soon, 2020, false)).toBe("Due 2028.");
    expect(itemDetail({ ...soon, installYearIsEstimate: true }, 2020, true)).toBe("Due 2028. Install year 2020 is a guess.");
    expect(itemDetail({ ...overdue, installYearIsEstimate: true }, 1998, false)).toBe(
      "Past due since 2011. No install year, so year built (1998) is used.",
    );
  });

  it("leads with how many items it replaces, and asks for a tick when there are none", () => {
    expect(shown(leadVariants(4, 4, 2026))).toEqual(["If you replace all 4 items below in 2026:"]);
    expect(shown(leadVariants(1, 1, 2026))).toEqual(["If you replace the item below in 2026:"]);
    expect(shown(leadVariants(2, 4, 2026))).toEqual(["If you replace the 2 ticked items in 2026:"]);
    expect(shown(leadVariants(1, 4, 2026))).toEqual(["If you replace the ticked item in 2026:"]);
    expect(shown(leadVariants(0, 4, 2026))).toEqual(["Tick at least one item below to compare."]);
    // Always three variants drawn in one spot, so the height never changes while ticking.
    expect(leadVariants(0, 4, 2026)).toHaveLength(3);
  });

  it("gives what waiting would mean, comparing figures as the screen shows them", () => {
    expect(ifYouWait("$30,000", "$12,000")).toBe("$12,000 if you wait");
    expect(ifYouWait("$12,000", "$12,000")).toBe("Same if you wait");
  });

  it("gives the change in the 10-year total in whole dollars", () => {
    expect(totalChange(150000, 152000)).toEqual({ change: "$2,000 more", detail: "$152,000, or $150,000 if you wait" });
    expect(totalChange(150000, 148700)).toEqual({ change: "$1,300 less", detail: "$148,700, or $150,000 if you wait" });
    expect(totalChange(150000, 150000.2)).toEqual({ change: "No change", detail: "$150,000 either way" });
  });

  it("says lower only when the monthly amount shown is lower", () => {
    expect(shown(reserveVariants(1250, 1100))).toEqual([RESERVE_LOWER_TEXT]);
    expect(RESERVE_LOWER_TEXT).toBe("The monthly amount is lower because these are paid now instead of saved for.");
    // $1,249.40 and $1,249.90 both show as $1,250.
    expect(shown(reserveVariants(1249.9, 1249.4))).toEqual([RESERVE_SAME_TEXT]);
    expect(shown(reserveVariants(1100, 1100))).toEqual([RESERVE_SAME_TEXT]);
    expect(shown(reserveVariants(1100, 1250))).toEqual([RESERVE_HIGHER_TEXT]);
    expect(reserveVariants(1, 1)).toHaveLength(3);
  });

  it("gives per unit when there are units", () => {
    const figures = (perUnit: number | null) => ({ neededNow: 0, total: 0, monthlyReserve: 0, monthlyReservePerUnit: perUnit });
    expect(perUnitText(figures(104.2), figures(91.6))).toBe("$92 per unit, or $105 if you wait");
    expect(perUnitText(figures(91.6), figures(91.2))).toBe("$92 per unit, same if you wait");
    expect(perUnitText(figures(null), figures(null))).toBeNull();
  });

  it("explains that items past end of life or due this year are paid this year either way", () => {
    const mixed = [{ endOfLifeYear: 2011 }, { endOfLifeYear: 2028 }];
    const allNow = [{ endOfLifeYear: 2011 }, { endOfLifeYear: 2026 }];
    expect(eitherWayVariants([{ endOfLifeYear: 2027 }, { endOfLifeYear: 2028 }], 2026, 0)).toEqual([]);
    expect(eitherWayVariants([{ endOfLifeYear: 2027 }], 2026, 20)).toEqual([]);
    expect(shown(eitherWayVariants(mixed, 2026, 0))).toEqual([
      "Items past end of life or due in 2026 are paid in 2026 either way, so the difference comes from items due in the next 2 years.",
    ]);
    expect(shown(eitherWayVariants(allNow, 2026, 0))).toEqual([
      "Everything here is past end of life or due in 2026, so it's paid in 2026 either way.",
    ]);
  });

  it("adds the emergency extra to the explanation once there's a percent, in the same spot", () => {
    const mixed = [{ endOfLifeYear: 2011 }, { endOfLifeYear: 2028 }];
    expect(shown(eitherWayVariants(mixed, 2026, 20))).toEqual([
      "Items past end of life or due in 2026 are paid in 2026 either way, so the difference comes from items due in the next 2 years and the emergency extra.",
    ]);
    expect(shown(eitherWayVariants([{ endOfLifeYear: 2011 }], 2026, 20))).toEqual([
      "Everything here is past end of life or due in 2026, so it's paid in 2026 either way. Only the emergency extra differs.",
    ]);
    // Both drawn every time, so typing a percent never changes the height.
    expect(eitherWayVariants(mixed, 2026, 0)).toHaveLength(2);
    expect(eitherWayVariants(mixed, 2026, 20)).toHaveLength(2);
  });
});

describe("the comparison for screen readers", () => {
  const heater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
  const draft: Draft = {
    unitCount: "10",
    yearBuilt: "",
    // Ten heaters due 2027 at $1,500, so $15,000.
    rows: [{ ...rowFromLibrary(heater, "10"), installYear: "2017", costEach: "1500" }],
  };
  const comparison = (only?: ReadonlySet<string>): ReplaceNowComparison =>
    compareReplaceNow({ startYear: 2026, unitCount: 10, components: toComponents(draft, 2026).components }, { only });

  it("reads out this year's cash, the 10-year change and the monthly reserve", () => {
    // Waiting: $15,000 in 2027 needs $1,250 a month. Replacing now: next one in 2036 is 120 months away.
    expect(compareSummary(comparison(), 2026)).toBe(
      "If you replace the item below in 2026: Cash needed in 2026: $15,000, $0 if you wait. " +
        "10-year total: no change. Monthly reserve: $125, $1,250 if you wait. " +
        "The monthly amount is lower because these are paid now instead of saved for.",
    );
  });

  it("only asks for a tick when nothing is chosen", () => {
    expect(compareSummary(comparison(new Set()), 2026)).toBe("Tick at least one item below to compare.");
  });
});
