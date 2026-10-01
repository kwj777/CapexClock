import { renderToStaticMarkup } from "react-dom/server";
import CompareAtRisk from "../CompareAtRisk";
import { exampleDraft, toComponents } from "../draft";

// The first render only: opening it, ticking and Apply are checked in the browser.

describe("the replace-now comparison before it's opened", () => {
  const draft = exampleDraft();
  const { components } = toComponents(draft, 2026);
  const html = renderToStaticMarkup(
    <CompareAtRisk
      startYear={2026}
      unitCount={12}
      components={components}
      rows={new Map(draft.rows.map((r) => [r.id, r]))}
      draft={draft}
      setDraft={() => undefined}
    />,
  );

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
});
