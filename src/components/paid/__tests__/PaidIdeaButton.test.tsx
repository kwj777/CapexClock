import { renderToStaticMarkup } from "react-dom/server";
import { PAID_IDEAS, type PaidIdea, type PaidWhere } from "@/lib/paid-ideas";
import PaidIdeaButton from "../PaidIdeaButton";
import TellMeFirstForm from "../TellMeFirstForm";

// The first render only: opening a panel, sending the form and the events are
// checked in the browser.

describe("paid idea buttons", () => {
  /**
   * Renders with NEXT_PUBLIC_TEST_BUTTONS set to `setting` (or unset), using a
   * fresh copy of the modules (React included), since the setting is read when
   * the module loads. That way a Netlify setting can't change what's tested.
   */
  async function renderWith(setting: string | undefined, ideas: readonly PaidIdea[], where: PaidWhere = "property") {
    const before = process.env.NEXT_PUBLIC_TEST_BUTTONS;
    if (setting === undefined) delete process.env.NEXT_PUBLIC_TEST_BUTTONS;
    else process.env.NEXT_PUBLIC_TEST_BUTTONS = setting;
    let html = "";
    try {
      await jest.isolateModulesAsync(async () => {
        const { renderToStaticMarkup: render } = await import("react-dom/server");
        const { default: Provider } = await import("../PaidIdeas");
        const { default: Button } = await import("../PaidIdeaButton");
        html = render(
          <Provider where={where}>
            {ideas.map((idea) => (
              <Button key={idea} idea={idea} />
            ))}
          </Provider>,
        );
      });
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_TEST_BUTTONS;
      else process.env.NEXT_PUBLIC_TEST_BUTTONS = before;
    }
    return html;
  }

  it("show the idea's words, marked as an idea, closed", async () => {
    const html = await renderWith(undefined, ["photo"], "calculator");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("<span>Add from a photo of the label</span>");
    expect(html).toContain(">Idea</span>");
    expect(html).toContain('aria-label="Add from a photo of the label, Idea"');
    expect(html).not.toContain("Not built yet");
  });

  it("stay hidden outside a page that sets them up", () => {
    expect(renderToStaticMarkup(<PaidIdeaButton idea="report" />)).toBe("");
  });

  it("all go when NEXT_PUBLIC_TEST_BUTTONS is off", async () => {
    expect(await renderWith("off", PAID_IDEAS)).toBe("");
    expect((await renderWith("on", PAID_IDEAS)).match(/>Idea<\/span>/g)).toHaveLength(3);
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

describe("the Stripe links the panels get", () => {
  it("are read from the Netlify settings, and only valid ones count", async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = { ...env };
    try {
      env.NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP = "https://buy.stripe.com/test_m";
      env.NEXT_PUBLIC_STRIPE_LINK_REPORT = "https://example.com/r";
      let html = "";
      // A fresh copy of the modules (React included), so the settings are read again.
      await jest.isolateModulesAsync(async () => {
        const { renderToStaticMarkup: render } = await import("react-dom/server");
        const { default: Provider, usePaidIdeas } = await import("../PaidIdeas");
        function Links() {
          return <>{JSON.stringify(usePaidIdeas().offerLinks)}</>;
        }
        html = render(
          <Provider where="calculator">
            <Links />
          </Provider>,
        );
      });
      expect(JSON.parse(html.replace(/&quot;/g, '"'))).toEqual({
        membership: "https://buy.stripe.com/test_m",
        report: null,
      });
    } finally {
      for (const key of Object.keys(env)) if (!(key in before)) delete env[key];
      Object.assign(env, before);
    }
  });
});
