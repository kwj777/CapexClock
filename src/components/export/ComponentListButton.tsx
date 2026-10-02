"use client";

import { useState } from "react";
import type { Draft } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { componentListCsv } from "@/lib/export/component-list";
import { componentListFileName } from "@/lib/export/csv";
import { download } from "./download";

/**
 * Downloads every component in CapexClock's spreadsheet format, with each row's
 * CapexClock ID, so the owner can edit it in Excel and import it again to update
 * the same rows. Made in the browser; nothing is sent anywhere.
 */
export default function ComponentListButton({
  name,
  building,
  draft,
  where,
  className,
}: {
  /** For the file name. */
  name: string;
  /** For the Building column: the property's name, or blank in the public calculator. */
  building: string;
  draft: Pick<Draft, "rows" | "unitCount" | "yearBuilt">;
  /** Where the button is, for component_list_exported. */
  where: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  function exportList() {
    setFailed(false);
    try {
      const csv = componentListCsv({ name: building, unitCount: draft.unitCount, yearBuilt: draft.yearBuilt }, draft.rows);
      download(new Blob([csv], { type: "text/csv;charset=utf-8" }), componentListFileName(name));
      void track("component_list_exported", { components: draft.rows.length, where });
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button type="button" onClick={exportList} className={className}>
        Download component list (CSV)
      </button>
      {failed && (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          The download didn&apos;t work. Please try again.
        </span>
      )}
    </>
  );
}
