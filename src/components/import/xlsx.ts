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

/**
 * Unpacks one deflated file of a zip with the browser's own DecompressionStream,
 * to read which tabs are hidden. Browsers without it just don't mark any.
 */
export async function inflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
