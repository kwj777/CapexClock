import { renderToStaticMarkup } from "react-dom/server";
import { BOM, exampleRows } from "@/lib/export/component-list";
import { FORMAT_COLUMNS, FORMAT_HEADINGS, TEMPLATE_FILES } from "@/lib/import/format";
import { COMPONENT_LIBRARY } from "@/lib/library/components";
import { GET as getExample } from "../capexclock-example.csv/route";
import { GET as getTemplate } from "../capexclock-template.csv/route";
import { FAQ } from "../faq";
import TemplatePage from "../page";

jest.mock("@/lib/library/source", () => ({ getLibrary: async () => COMPONENT_LIBRARY }));
// The import box is a client component that needs Next's router; the page test is about the page.
jest.mock("@/components/import/TemplateImport", () => () => null);

const decode = (html: string) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

async function render() {
  const html = renderToStaticMarkup(await TemplatePage());
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  const visible = decode(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  return { html, json: json ? JSON.parse(json) : null, visible };
}

describe("the spreadsheet template page", () => {
  it("gives search engines the same questions and answers the page shows", async () => {
    const { json, visible } = await render();
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity).toHaveLength(FAQ.length);
    for (const [i, { q, a }] of FAQ.entries()) {
      expect(json.mainEntity[i]).toEqual({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } });
      expect(visible).toContain(q);
      expect(visible).toContain(a);
    }
  });

  it("says what each column is for, and links both downloads", async () => {
    const { html, visible } = await render();
    for (const c of FORMAT_COLUMNS) {
      expect(visible).toContain(c.what);
      expect(visible).toContain(c.why);
    }
    for (const f of Object.values(TEMPLATE_FILES)) expect(html).toContain(`href="${f.path}" download="${f.name}"`);
  });

  it("shows the filled-in example's rows", async () => {
    const { visible } = await render();
    for (const r of exampleRows()) expect(visible).toContain(r.name);
  });

  it("writes copy without em or en dashes", async () => {
    const { visible } = await render();
    expect(visible).not.toMatch(/[–—]/);
  });
});

describe("the template downloads", () => {
  it("serve the template and the example as CSV files to save", async () => {
    for (const [response, name] of [
      [getTemplate(), TEMPLATE_FILES.template.name],
      [getExample(), TEMPLATE_FILES.example.name],
    ] as const) {
      expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${name}"`);
      const text = await response.text();
      // Response.text() drops the byte-order mark, so read the bytes for it.
      expect(text.split("\r\n")[0]).toBe(FORMAT_HEADINGS.join(","));
    }
    const bytes = new Uint8Array(await getTemplate().arrayBuffer());
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).startsWith(BOM)).toBe(true);
    expect((await getExample().text()).trimEnd().split("\r\n")).toHaveLength(exampleRows().length + 1);
  });
});
