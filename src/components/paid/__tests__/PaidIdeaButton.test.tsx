import { renderToStaticMarkup } from "react-dom/server";
import PaidIdeaButton from "../PaidIdeaButton";
import PaidIdeasProvider from "../PaidIdeas";
import TellMeFirstForm from "../TellMeFirstForm";

// The first render only: opening a panel, sending the form and the events are
// checked in the browser.

describe("paid idea buttons", () => {
  it("show the idea's words, marked as an idea, closed", () => {
    const html = renderToStaticMarkup(
      <PaidIdeasProvider where="calculator">
        <PaidIdeaButton idea="photo" />
      </PaidIdeasProvider>,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("<span>Add from a photo of the label</span>");
    expect(html).toContain(">Idea</span>");
    // Read as "Add from a photo of the label, Idea".
    expect(html).toContain('<span class="sr-only">, </span>');
    expect(html).not.toContain("Not built yet");
  });

  it("stay hidden outside a page that sets them up", () => {
    expect(renderToStaticMarkup(<PaidIdeaButton idea="report" />)).toBe("");
  });

  it("all go when NEXT_PUBLIC_TEST_BUTTONS is off", async () => {
    const before = process.env.NEXT_PUBLIC_TEST_BUTTONS;
    // A fresh copy of the modules (React included), so the setting is read again.
    async function renderWith(setting: string) {
      process.env.NEXT_PUBLIC_TEST_BUTTONS = setting;
      let html = "";
      await jest.isolateModulesAsync(async () => {
        const { renderToStaticMarkup: render } = await import("react-dom/server");
        const { default: Provider } = await import("../PaidIdeas");
        const { default: Button } = await import("../PaidIdeaButton");
        html = render(
          <Provider where="property">
            <Button idea="reminders" />
            <Button idea="report" />
            <Button idea="photo" />
          </Provider>,
        );
      });
      return html;
    }
    try {
      expect(await renderWith("off")).toBe("");
      expect((await renderWith("on")).match(/>Idea<\/span>/g)).toHaveLength(3);
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_TEST_BUTTONS;
      else process.env.NEXT_PUBLIC_TEST_BUTTONS = before;
    }
  });
});

describe("the tell me first form", () => {
  const html = renderToStaticMarkup(
    <TellMeFirstForm idea="report" where="property" defaultEmail="owner@example.com" onSignedUp={() => {}} />,
  );

  it("posts to the Netlify form like the early-access form, with JavaScript or without", () => {
    expect(html).toMatch(/^<form name="paid-interest" data-netlify="true" netlify-honeypot="bot-field"/);
    expect(html).toContain('action="/__forms.html" method="POST">');
    expect(html).toContain('<input type="hidden" name="form-name" value="paid-interest"/>');
    expect(html).toContain('<input type="hidden" name="idea" value="report"/>');
    expect(html).toContain('<input type="hidden" name="where" value="property"/>');
    expect(html).toContain('<input tabindex="-1" autoComplete="off" name="bot-field"/>');
  });

  it("doesn't ask the property editor about unsaved changes", () => {
    expect(html).toContain("data-keeps-edits");
  });

  it("fills in the signed-in owner's email and asks for units", () => {
    expect(html).toContain('name="email" value="owner@example.com"/>');
    expect(html).toContain("How many units do you own?");
    for (const units of ["1–4", "5–20", "21–50", "51–100", "100+"]) expect(html).toContain(`>${units}</option>`);
    expect(html).toContain(">Tell me first</button>");
  });

  it("shows no errors before a send is tried", () => {
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain('role="alert"');
  });

  it("starts empty when the email isn't known", () => {
    const empty = renderToStaticMarkup(
      <TellMeFirstForm idea="photo" where="calculator" defaultEmail="" onSignedUp={() => {}} />,
    );
    expect(empty).toContain('name="email" value=""/>');
  });
});
