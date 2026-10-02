import writeXlsxFile from "write-excel-file/universal";
import { exampleGrid } from "@/lib/export/component-list";
import { xlsxResponse } from "@/lib/export/download-response";
import { listXlsx } from "@/lib/export/xlsx";
import { templateFile } from "@/lib/import/format";

// The same file for everyone, built once at build time.
export const dynamic = "force-static";

export async function GET() {
  return xlsxResponse(await listXlsx(exampleGrid(), writeXlsxFile), templateFile("example", "xlsx").name);
}
