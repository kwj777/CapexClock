import { renderToStaticMarkup } from "react-dom/server";
import { compareReplaceNow, type ForecastComponent } from "@/lib/forecast";
import CompareAtRisk, { ComparisonPanel } from "../CompareAtRisk";
import { NEW_COMPARE_STATE, type CompareState } from "../compare";
import { exampleDraft, toComponents } from "../draft";

// Clicks, focus and the live region are checked in the browser; what Apply and
// Undo do is in compare.test.ts. These check what each state draws.

describe("the replace-now comparison before it's opened", () => {
  const draft = exampleDraft();
  const { components } = toComponents(draft, 2026);
  const renderWith = (state: CompareState) =>
    renderToStaticMarkup(
      <CompareAtRisk
        startYear={2026}
        unitCount={12}
        components={components}
        rows={new Map(draft.rows.map((r) => [r.id, r]))}
        draft={draft}
        setDraft={() => undefined}
        state={state}
        setState={() => undefined}
      />,
    );
  const html = renderWith(NEW_COMPARE_STATE);

  it("is a closed button that controls the panel", () => {
    expect(html).toContain(">What if we replace everything at risk now?");
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`id="${controls}" hidden=""`);
  });

  it("changes nothing and shows no figures until it's opened", () => {
    expect(html).not.toContain("Cash needed");
    expect(html).not.toContain("Apply");
    expect(html).not.toContain("Undo");
  });

  it("keeps a live region in the page, so later changes are read out", () => {
    expect(html).toContain('aria-live="polite"');
  });

  it("draws the state the calculator kept, so it comes back as it was after the list empties", () => {
    const carpet = components.find((c) => c.name === "Carpet")!.id;
    const kept = renderWith({ ...NEW_COMPARE_STATE, open: true, viewed: true, percentText: "20", unticked: new Set([carpet]) });
    expect(kept).toContain('aria-expanded="true"');
    expect(kept).toContain("Cash needed in 2026");
    expect(kept).toContain('value="20"');
    expect(kept.match(/<input type="checkbox"[^>]* checked=""/g)).toHaveLength(3);
    expect(kept).toContain(">Apply to 3 items<");
  });
});

describe("the open panel", () => {
  const draft = exampleDraft();
  const { components } = toComponents(draft, 2026);
  const rows = new Map(draft.rows.map((r) => [r.id, r]));
  const idOf = (name: string) => components.find((c) => c.name === name)!.id;
  const noop = () => undefined;

  function render({
    list = components,
    unticked = new Set<string>(),
    percentText = "",
    showPercentError = false,
  }: { list?: ForecastComponent[]; unticked?: ReadonlySet<string>; percentText?: string; showPercentError?: boolean } = {}) {
    const percent = showPercentError ? 0 : Number(percentText || 0);
    const comparison = compareReplaceNow(
      { startYear: 2026, unitCount: 12, components: list },
      { only: new Set(list.filter((c) => !unticked.has(c.id)).map((c) => c.id)), emergencyPercent: percent },
    );
    return renderToStaticMarkup(
      <ComparisonPanel
        baseId="c"
        applyId="c-apply"
        startYear={2026}
        comparison={comparison}
        byId={new Map(list.map((c) => [c.id, c]))}
        rows={rows}
        unticked={unticked}
        onTick={noop}
        percentText={percentText}
        percent={percent}
        showPercentError={showPercentError}
        onPercentChange={noop}
        onPercentEditing={noop}
        onApply={noop}
      />,
    );
  }

  /** The text of the variants drawn in one spot that are actually shown. */
  const shownLines = (html: string) =>
    [...html.matchAll(/<p (?:id="[^"]*" )?class="col-start-1 row-start-1 ([^"]*)">([^<]*)<\/p>/g)]
      .filter(([, className]) => !className.split(" ").includes("invisible"))
      .map(([, , text]) => text);
  const applyButton = (html: string) => html.match(/<button id="c-apply"[^>]*>[^<]*<\/button>/)?.[0] ?? "";
  const fieldsets = (html: string) => [...html.matchAll(/<fieldset>([\s\S]*?)<\/fieldset>/g)].map(([, inner]) => inner);

  it("leads with this year's cash and the 10-year change, then the monthly reserve", () => {
    const html = render();
    const order = [
      "Cash needed in 2026",
      "$70,400",
      "$30,000 if you wait",
      "10-year total",
      "$38,400 more",
      "Monthly reserve",
      "$1,884",
      "$2,684 if you wait",
    ];
    const at = order.map((text) => html.indexOf(text));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(shownLines(html)).toEqual(
      expect.arrayContaining([
        "If you replace all 4 items below in 2026:",
        "The monthly amount is lower because these are paid now instead of saved for.",
        // The refrigerator is past end of life, so it's paid in 2026 either way.
        "Items past end of life or due in 2026 are paid in 2026 either way, so the difference comes from items due in the next 2 years.",
      ]),
    );
  });

  it("lists the blank install year apart, under its own heading, all ticked", () => {
    const html = render();
    const [sure, toCheck] = fieldsets(html);
    expect(sure).toContain("Replace in 2026</legend>");
    for (const name of ["Tank water heater", "Parking lot seal coat", "Carpet"]) expect(sure).toContain(name);
    expect(sure).not.toContain("Refrigerator");
    expect(toCheck).toContain("Check these install years before applying.</legend>");
    expect(toCheck).toContain("Refrigerator");
    expect(toCheck).toContain("No install year, so year built (1998) is used.");
    expect(html.match(/<input type="checkbox"[^>]* checked=""/g)).toHaveLength(4);
    expect(applyButton(html)).toContain(">Apply to 4 items<");
    expect(applyButton(html)).not.toContain('disabled=""');
  });

  it("only says lower when it is", () => {
    // Without the carpet, the monthly amount doesn't come down.
    const html = render({ unticked: new Set([idOf("Carpet")]) });
    expect(shownLines(html)).toContain("The monthly amount stays the same.");
    expect(shownLines(html)).not.toContain(
      "The monthly amount is lower because these are paid now instead of saved for.",
    );
    expect(html.match(/<input type="checkbox"[^>]* checked=""/g)).toHaveLength(3);
  });

  it("asks for a tick and can't be applied with nothing ticked", () => {
    const html = render({ unticked: new Set(components.map((c) => c.id)) });
    expect(shownLines(html)).toContain("Tick at least one item below to compare.");
    expect(applyButton(html)).toContain('disabled=""');
    expect(applyButton(html)).toContain(">Apply<");
  });

  it("names the emergency box and points it at the hint, the note or the error", () => {
    const empty = render();
    expect(empty).toContain('aria-labelledby="c-percent-label c-percent-suffix"');
    expect(empty).toContain('aria-describedby="c-percent-hint"');
    expect(empty).not.toContain("aria-invalid");

    const twenty = render({ percentText: "20" });
    expect(twenty).toContain('aria-describedby="c-percent-note"');
    expect(twenty).toContain("$36,000 if you wait");
    expect(shownLines(twenty)).toContain(
      "Items past end of life or due in 2026 are paid in 2026 either way, so the difference comes from items due in the next 2 years and the emergency extra.",
    );

    const bad = render({ percentText: "abc", showPercentError: true });
    expect(bad).toContain('aria-invalid="true"');
    expect(bad).toContain('aria-describedby="c-percent-error"');
    expect(shownLines(bad)).toContain("Enter a percent from 0 to 500, like 25.");
  });

  it("says so when everything at risk is already set to replace this year", () => {
    const html = render({ list: components.map((c) => ({ ...c, scenario: "replace_now" })) });
    expect(html).toContain("Everything at risk is set to Replace this year.");
    expect(html).not.toContain("Apply");
    expect(html).not.toContain("Cash needed");
  });
});
