"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { exportFileName, forecastCsv } from "@/lib/export/csv";
import type { ExportDetails } from "@/lib/export/rows";
import type { Forecast, ForecastComponent, UnitLabel } from "@/lib/forecast";
import PayQuestion from "./PayQuestion";

type Format = "csv" | "pdf";

/** A calculator form row, as far as the exports need it. */
export interface ExportFormRow {
  id: string;
  name: string;
  category: string;
  unitLabel: UnitLabel;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const button =
  "rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800";

export default function ExportButtons({
  name,
  unitCount,
  forecast,
  components,
  rows,
}: {
  name: string;
  unitCount: number;
  forecast: Forecast;
  components: ForecastComponent[];
  /** Every form row, so exports show units and name the rows left out. */
  rows: ExportFormRow[];
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [exported, setExported] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);

  async function exportAs(format: Format) {
    setBusy(format);
    setFailed(false);
    const included = new Set(components.map((c) => c.id));
    const details: ExportDetails = {
      unitLabels: new Map(rows.map((r) => [r.id, r.unitLabel])),
      leftOut: rows
        .filter((r) => !included.has(r.id))
        .map((r) => ({ name: r.name.trim() || "Unnamed component", category: r.category })),
    };
    try {
      if (format === "csv") {
        // The byte-order mark makes Excel read the file as UTF-8.
        const csv = "﻿" + forecastCsv(forecast, components, details);
        download(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFileName(name, "csv", forecast.startYear));
      } else {
        // The PDF library is large, so it's only loaded when asked for.
        const { forecastPdfBlob } = await import("./ForecastPdf");
        const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const blob = await forecastPdfBlob({ name, unitCount, forecast, components, details, generatedOn });
        download(blob, exportFileName(name, "pdf", forecast.startYear));
      }
      void track(format === "pdf" ? "pdf_exported" : "csv_exported", { components: String(components.length) });
      setExported(format);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={busy !== null} onClick={() => exportAs("pdf")}>
          {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" className={button} disabled={busy !== null} onClick={() => exportAs("csv")}>
          Download CSV
        </button>
        {failed && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-400">
            The download didn&apos;t work. Please try again.
          </span>
        )}
      </div>
      {exported && <PayQuestion trigger={exported} />}
    </div>
  );
}
