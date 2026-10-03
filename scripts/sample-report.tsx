// Makes public/sample-condition-report.pdf, the sample linked from /pricing,
// the report panel and the thank-you page. Run it again whenever the report's
// layout or the calculator's example changes (or in a new year, so the dates
// stay current):
//
//   npm run sample-report
//
// SAMPLE_REPORT_DATE=2026-10-01 fixes the "prepared" date (and the forecast's
// first year); it's today by default.

import { Font, renderToFile } from "@react-pdf/renderer";
import { join } from "node:path";
import ConditionReportPdf, { REPORT_FONT } from "@/components/report/ConditionReportPdf";
import { SAMPLE_NOTE, sampleReport } from "@/verticals/landlord";

const root = join(__dirname, "..");
const out = join(root, "public", "sample-condition-report.pdf");

function preparedDate(setting: string | undefined): Date {
  if (!setting) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(setting.trim());
  if (!match) throw new Error(`SAMPLE_REPORT_DATE should look like 2026-10-01, not "${setting}".`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

async function main() {
  Font.register({
    family: REPORT_FONT,
    fonts: [
      { src: join(root, "public", "fonts", "DejaVuSans.ttf") },
      { src: join(root, "public", "fonts", "DejaVuSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Lines break between words only, never "estimat-ed".
  Font.registerHyphenationCallback((word) => [word]);
  const date = preparedDate(process.env.SAMPLE_REPORT_DATE);
  const report = sampleReport(date.getFullYear());
  await renderToFile(
    <ConditionReportPdf
      {...report}
      preparedOn={date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      informationAsOf={date.toLocaleDateString("en-US", { year: "numeric", month: "long" })}
      sampleNote={SAMPLE_NOTE}
    />,
    out,
  );
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
