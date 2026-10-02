import type { CsvParse } from "@/lib/import/read";

/** Loads papaparse when the import panel opens, so the calculator itself doesn't carry it. */
export async function loadCsvParser(): Promise<CsvParse> {
  const mod = await import("papaparse");
  // A CommonJS module: bundlers hand it over as the default export, and some as the module itself.
  const Papa = mod.default ?? mod;
  return (text, delimiter) => {
    const result = Papa.parse<unknown[]>(text, { delimiter, skipEmptyLines: false });
    return { data: result.data, errors: result.errors };
  };
}
