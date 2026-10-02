/**
 * Builds small .xlsx files for tests, so no real owner's workbook is ever
 * committed. Each file is a zip (stored, or deflated as Excel saves it) with one
 * worksheet per tab, inline strings, and a date style for Date cells, which is
 * all read-excel-file needs to read it as Excel would have saved it.
 */
import { deflateRawSync } from "node:zlib";

/** A cell as written: text, a number, a yes/no, a date, or empty. */
export type FixtureCell = string | number | boolean | Date | null;

export interface FixtureTab {
  name: string;
  rows: FixtureCell[][];
  /** Hidden in Excel (right-click, Hide), or only from code ("veryHidden"). */
  state?: "hidden" | "veryHidden";
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip of the files, stored without compression or deflated. */
function zip(files: { name: string; data: Uint8Array }[], deflate: boolean): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const data = deflate ? new Uint8Array(deflateRawSync(file.data)) : file.data;
    const method = deflate ? 8 : 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(10, method, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** "A", "B", … "AA" for a column index. */
function column(index: number): string {
  let s = "";
  for (let i = index + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function cellXml(value: FixtureCell, ref: string): string {
  if (value === null || value === "") return "";
  if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (value instanceof Date) {
    // Excel keeps dates as days since 1899-12-30, shown with a date format (style 1).
    const serial = (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
    return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
}

function sheetXml(rows: FixtureCell[][]): string {
  const body = rows
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cellXml(v, `${column(c)}${r + 1}`)).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml";

/** An .xlsx file with these tabs, as the bytes a file input would give. */
export function xlsxFile(tabs: FixtureTab[], { deflate = false }: { deflate?: boolean } = {}): ArrayBuffer {
  const encoder = new TextEncoder();
  const text = (name: string, xml: string) => ({ name, data: encoder.encode(xml) });
  const files = [
    text(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/>${tabs
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${TYPE}.worksheet+xml"/>`)
        .join("")}<Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/></Types>`,
    ),
    text(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    text(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${tabs
        .map((t, i) => `<sheet name="${escape(t.name)}" sheetId="${i + 1}"${t.state ? ` state="${t.state}"` : ""} r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    text(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_REL}">${tabs
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${tabs.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    text(
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${MAIN}"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ),
    ...tabs.map((t, i) => text(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(t.rows))),
  ];
  const bytes = zip(files, deflate);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
