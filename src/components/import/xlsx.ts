import type { XlsxRead } from "@/lib/import/xlsx";

/**
 * Loads read-excel-file when an Excel file is chosen, so the importer itself
 * doesn't carry it. The "universal" build reads from an ArrayBuffer in the page,
 * with nothing sent anywhere.
 */
export async function loadXlsxReader(): Promise<XlsxRead> {
  const { default: readXlsxFile } = await import("read-excel-file/universal");
  return (data) => readXlsxFile(data);
}
