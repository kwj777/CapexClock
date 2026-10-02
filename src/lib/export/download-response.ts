import { XLSX_TYPE } from "./xlsx";

/** A file to download, named, that browsers save instead of showing. */
function downloadResponse(body: BodyInit, type: string, fileName: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export function csvResponse(csv: string, fileName: string): Response {
  return downloadResponse(csv, "text/csv; charset=utf-8", fileName);
}

export function xlsxResponse(xlsx: Blob, fileName: string): Response {
  return downloadResponse(xlsx, XLSX_TYPE, fileName);
}
