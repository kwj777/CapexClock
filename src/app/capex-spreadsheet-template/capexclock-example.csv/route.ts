import { exampleCsv } from "@/lib/export/component-list";
import { csvResponse } from "@/lib/export/download-response";
import { templateFile } from "@/lib/import/format";

// The same file for everyone, built once at build time.
export const dynamic = "force-static";

export function GET() {
  return csvResponse(exampleCsv(), templateFile("example", "csv").name);
}
