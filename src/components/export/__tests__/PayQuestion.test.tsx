import { renderToStaticMarkup } from "react-dom/server";
import PayQuestion, { PAY_QUESTION } from "../PayQuestion";

// The first render only: effects (remembering that it was shown, moving focus)
// don't run here and are checked in the browser.

type Global = { window?: unknown };

function renderWith(stored: string | null, trigger: "csv" | "pdf" | null): string {
  const global = globalThis as Global;
  global.window = { localStorage: { getItem: () => stored, setItem: () => undefined } };
  try {
    return renderToStaticMarkup(<PayQuestion trigger={trigger} />);
  } finally {
    delete global.window;
  }
}

describe("pay question", () => {
  it("keeps an empty live region in the page before any export, so the question is announced", () => {
    const html = renderWith(null, null);
    expect(html).toBe('<div aria-live="polite"></div>');
  });

  it("shows the question inside the live region after the first export", () => {
    const html = renderWith(null, "csv");
    expect(html.startsWith('<div aria-live="polite">')).toBe(true);
    expect(html).toContain(PAY_QUESTION);
    for (const answer of ["Yes", "Maybe", "No"]) expect(html).toContain(`>${answer}</button>`);
    expect(html).toContain('aria-label="Dismiss question"');
  });

  it("names the answers' group with the question, so Yes, Maybe and No aren't read bare", () => {
    const html = renderWith(null, "csv");
    const id = html.match(/<p id="([^"]+)"[^>]*>[^<]*Would you pay/)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`<div role="group" aria-labelledby="${id}"`);
  });

  it("stays away once this browser has seen it, answered or not", () => {
    for (const stored of ["shown", "dismissed", "No"]) {
      expect(renderWith(stored, "pdf")).toBe('<div aria-live="polite"></div>');
    }
  });
});
