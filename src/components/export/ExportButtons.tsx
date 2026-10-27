"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { exportFileName, forecastCsv } from "@/lib/export/csv";
import { exportDetails, formFacts } from "@/lib/export/rows";
import { PaidIdeaDisclosure } from "@/components/paid/PaidIdeaButton";
import type { Component, Draft, DraftRow, LandlordForecast } from "@/verticals/landlord";
import ComponentListButton from "./ComponentListButton";
import { download } from "./download";
import PayQuestion from "./PayQuestion";

type Format = "csv" | "pdf";

// aria-disabled rather than disabled while busy, so keyboard focus stays on the button.
const button =
  "rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 aria-disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800";

export default function ExportButtons({
  name,
  unitCount,
  forecast,
  components,
  rows,
  yearBuilt,
  list,
  onPayQuestionChange,
}: {
  name: string;
  unitCount: number;
  forecast: LandlordForecast;
  components: readonly Component[];
  /** Every form row, so exports show units and name the rows left out, and why. */
  rows: DraftRow[];
  /** As typed, for the PDF's subtitle; a year that can't be right is left out. */
  yearBuilt: string;
  /** The whole list, for the component list download, and the name for its Building column. */
  list?: { draft: Pick<Draft, "rows" | "unitCount" | "yearBuilt">; building: string };
  /** Told while the pay question waits for an answer. */
  onPayQuestionChange?: (asking: boolean) => void;
}) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [exported, setExported] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);
  const buttons = useRef<Record<Format, HTMLButtonElement | null>>({ csv: null, pdf: null });

  async function exportAs(format: Format) {
    if (busy) return;
    setBusy(format);
    setFailed(false);
    const details = exportDetails(rows, components, formFacts({ yearBuilt, rows }, forecast.startYear));
    try {
      if (format === "csv") {
        // The byte-order mark makes Excel read the file as UTF-8.
        const csv = "﻿" + forecastCsv(forecast, components, details, name);
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
    // The condition report idea sits with the downloads; its panel opens below them.
    <PaidIdeaDisclosure idea="report">
      {(reportButton, reportPanel) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              ref={(el) => {
                buttons.current.pdf = el;
              }}
              type="button"
              className={button}
              aria-disabled={busy !== null}
              onClick={() => exportAs("pdf")}
            >
              {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              ref={(el) => {
                buttons.current.csv = el;
              }}
              type="button"
              className={button}
              aria-disabled={busy !== null}
              onClick={() => exportAs("csv")}
            >
              Download forecast (CSV)
            </button>
            {list &&
              (["xlsx", "csv"] as const).map((format) => (
                <ComponentListButton
                  key={format}
                  format={format}
                  name={name}
                  building={list.building}
                  draft={list.draft}
                  where="downloads"
                  className={button}
                />
              ))}
            {reportButton}
            {failed && (
              <span role="alert" className="text-sm text-red-700 dark:text-red-400">
                The download didn&apos;t work. Please try again.
              </span>
            )}
          </div>
          {reportPanel && <div className="mt-3">{reportPanel}</div>}
          <PayQuestion
            trigger={exported}
            onDismiss={() => exported && buttons.current[exported]?.focus()}
            onAskingChange={onPayQuestionChange}
          />
        </div>
      )}
    </PaidIdeaDisclosure>
  );
}
