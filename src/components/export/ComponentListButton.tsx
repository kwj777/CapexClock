"use client";

import { useState } from "react";
import type { Draft } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { componentListGrid, listCsv, type ListGrid } from "@/lib/export/component-list";
import { componentListFileName } from "@/lib/export/csv";
import { listXlsx } from "@/lib/export/xlsx";
import { download } from "./download";

const LABEL = {
  xlsx: "Download component list (Excel)",
  csv: "Download component list (CSV)",
} as const;

/** Loads write-excel-file on the first Excel download, so the page doesn't carry it. */
async function xlsxBlob(list: ListGrid): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  return listXlsx(list, writeXlsxFile);
}

/**
 * Downloads every component in CapexClock's spreadsheet format, as an Excel file
 * or a CSV, with each row's CapexClock ID, so the owner can edit it and import it
 * again to update the same rows. Made in the browser; nothing is sent anywhere.
 */
export default function ComponentListButton({
  format,
  name,
  building,
  draft,
  where,
  className,
}: {
  format: "xlsx" | "csv";
  /** For the file name. */
  name: string;
  /** For the Building column: the property's name, or blank in the public calculator. */
  building: string;
  draft: Pick<Draft, "rows" | "unitCount" | "yearBuilt">;
  /** Where the button is, for component_list_exported. */
  where: string;
  className: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function exportList() {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      const list = componentListGrid({ name: building, unitCount: draft.unitCount, yearBuilt: draft.yearBuilt }, draft.rows);
      const blob = format === "xlsx" ? await xlsxBlob(list) : new Blob([listCsv(list)], { type: "text/csv;charset=utf-8" });
      download(blob, componentListFileName(name, format));
      void track("component_list_exported", { components: draft.rows.length, where, format });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void exportList()}
        aria-disabled={busy}
        className={`${className} aria-disabled:cursor-wait aria-disabled:opacity-60`}
      >
        {LABEL[format]}
      </button>
      {failed && (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          The download didn&apos;t work. Please try again.
        </span>
      )}
    </>
  );
}
