import { templateCsv } from "@/lib/export/component-list";
import { csvResponse } from "@/lib/export/csv-response";
import { TEMPLATE_FILES } from "@/lib/import/format";

// The same file for everyone, built once at build time.
export const dynamic = "force-static";

export function GET() {
  return csvResponse(templateCsv(), TEMPLATE_FILES.template.name);
}
