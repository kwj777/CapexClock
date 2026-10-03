// The yearly condition report for one member: a PDF per property, made with the
// same ConditionReportPdf as the sample on /pricing, and the email they go with.

import { Font, renderToBuffer } from "@react-pdf/renderer";
import ConditionReportPdf, { REPORT_FONT } from "@/components/report/ConditionReportPdf";
import { savedConditionReport } from "@/verticals/landlord";
import type { ConditionReportBuilder } from "./run";
import { conditionReportEmail, type ReportSummaryLine } from "./templates";

/** Where the report's font files are: URLs (the live site's /fonts) or file paths (tests, scripts). */
export interface ReportFonts {
  readonly regular: string;
  readonly bold: string;
}

/** The fonts on the live site, from public/fonts. */
export function siteFonts(site: string): ReportFonts {
  return {
    regular: new URL("/fonts/DejaVuSans.ttf", site).toString(),
    bold: new URL("/fonts/DejaVuSans-Bold.ttf", site).toString(),
  };
}

let registered: ReportFonts | null = null;

function registerFonts(fonts: ReportFonts) {
  if (registered?.regular === fonts.regular && registered.bold === fonts.bold) return;
  Font.register({
    family: REPORT_FONT,
    fonts: [{ src: fonts.regular }, { src: fonts.bold, fontWeight: 700 }],
  });
  // Lines break between words only, never "estimat-ed".
  Font.registerHyphenationCallback((word) => [word]);
  registered = fonts;
}

/** "Elm St #2" → "elm-st-2". */
export function fileSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "property";
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
const monthYear = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "America/Chicago" });

/** Builds the report email for the daily run. `now` is the prepared date printed on each report. */
export function conditionReportBuilder(fonts: ReportFonts, now: () => Date = () => new Date()): ConditionReportBuilder {
  return async (data, year, footer) => {
    registerFonts(fonts);
    const date = now();
    const lines: ReportSummaryLine[] = [];
    const attachments: { filename: string; content: string }[] = [];
    const used = new Set<string>();

    for (const property of data.properties) {
      const rows = data.components.filter((c) => c.property_id === property.id);
      const report = savedConditionReport(property, rows, year);
      if (!report) continue;
      const pdf = await renderToBuffer(
        <ConditionReportPdf {...report} preparedOn={longDate(date)} informationAsOf={monthYear(date)} />,
      );
      let base = `${fileSlug(property.name)}-condition-report-${year}`;
      for (let n = 2; used.has(base); n++) base = `${fileSlug(property.name)}-${n}-condition-report-${year}`;
      used.add(base);
      attachments.push({ filename: `${base}.pdf`, content: Buffer.from(pdf).toString("base64") });
      lines.push({
        propertyId: property.id,
        name: property.name,
        atRisk: report.rows.filter((r) => r.status !== "ok").length,
        unrated: report.unrated,
        excluded: report.excluded,
      });
    }
    if (lines.length === 0) return null;
    return { ...conditionReportEmail(lines, year, footer), attachments };
  };
}
