import { renderToStaticMarkup } from "react-dom/server";
import readExcelFile from "read-excel-file/universal";
import { BOM, exampleRows } from "@/lib/export/component-list";
import { FORMAT_COLUMNS, FORMAT_HEADINGS, TEMPLATE_FORMATS, templateFile } from "@/lib/import/format";
import { COMPONENT_LIBRARY } from "@/verticals/landlord";
import { GET as getExample } from "../capexclock-example.csv/route";
import { GET as getExampleXlsx } from "../capexclock-example.xlsx/route";
import { GET as getTemplate } from "../capexclock-template.csv/route";
import { GET as getTemplateXlsx } from "../capexclock-template.xlsx/route";
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
    for (const file of ["template", "example"] as const) {
      for (const format of TEMPLATE_FORMATS) {
        const { path, name } = templateFile(file, format);
        expect(html).toContain(`href="${path}" download="${name}"`);
      }
    }
    expect(visible).toContain("Download the template (Excel)");
    // Tags become spaces here, hence the space the browser doesn't show before the full stop.
    expect(visible).toContain("Prefer CSV? Get the template as CSV or the example as CSV . The import reads both.");
  });

  it("shows the filled-in example's rows, with Quantity blank on the ones counted per unit, as in the download", async () => {
    const { html, visible } = await render();
    for (const r of exampleRows()) expect(visible).toContain(r.name);
    expect(visible.match(/Blank: one per unit/g)).toHaveLength(exampleRows().filter((r) => r.unitLabel === "per_unit").length);
    // The scrolling table has its own name, not its section's again.
    expect(html).toContain('aria-label="Example rows (scrolls sideways)"');
    expect(html.match(/aria-labelledby="example-heading"/g)).toHaveLength(1);
  });

  it("writes copy without em or en dashes", async () => {
    const { visible } = await render();
    expect(visible).not.toMatch(/[–—]/);
  });
});

describe("the template downloads", () => {
  it("serve the template and the example as CSV files to save", async () => {
    for (const [response, name] of [
      [getTemplate(), templateFile("template", "csv").name],
      [getExample(), templateFile("example", "csv").name],
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

  it("serve the template and the example as Excel files to save", async () => {
    for (const [response, name, rows] of [
      [await getTemplateXlsx(), templateFile("template", "xlsx").name, 1],
      [await getExampleXlsx(), templateFile("example", "xlsx").name, exampleRows().length + 1],
    ] as const) {
      expect(name).toMatch(/\.xlsx$/);
      expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${name}"`);
      const [sheet] = await readExcelFile(await response.arrayBuffer());
      expect(sheet.sheet).toBe("Sheet1");
      expect(sheet.data[0]).toEqual(FORMAT_HEADINGS);
      expect(sheet.data).toHaveLength(rows);
    }
  });
});
