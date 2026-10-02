"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { track } from "@/lib/analytics";
import {
  decodeText,
  failedReason,
  fileKind,
  MAX_BYTES,
  readText,
  type CsvParse,
  type ImportSource,
  type Problem,
} from "@/lib/import/read";
import { readWorkbook, sniff, type Tab } from "@/lib/import/xlsx";
import { loadCsvParser } from "./csv";
import { inflateRaw, loadXlsxReader } from "./xlsx";

export const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
export const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
export const headingClass = "text-sm font-semibold text-slate-950 dark:text-white";
export const secondaryButton =
  "rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800";

/** Rows read from the paste box or a file, as one or more tabs. */
export interface SourceRead {
  source: ImportSource;
  tabs: Tab[];
  /** The chosen file's name, for naming properties; null for pasted rows. */
  fileName: string | null;
}

export interface SourcePickerProps {
  onRead: (read: SourceRead) => void;
  /** A paste or file that couldn't be read; the source is null for an empty paste box. */
  onProblem: (problem: Problem) => void;
  /** Says what the panel is for, after the usual words about pasting. */
  intro?: string;
}

/**
 * The paste box and the file chooser. Pasted rows and CSV files are read with
 * papaparse, loaded when this opens; Excel files with read-excel-file, loaded when
 * one is chosen. Everything is read in this browser, and nothing is uploaded.
 * Sends import_started once, when rows are pasted or a file is chosen, and
 * import_failed for anything that can't be read.
 */
export default function SourcePicker({ onRead, onProblem, intro }: SourcePickerProps) {
  const baseId = useId();
  const pasteId = `${baseId}-paste`;
  const pasteHintId = `${baseId}-paste-hint`;
  const [parse, setParse] = useState<CsvParse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reading, setReading] = useState(false);
  const [text, setText] = useState("");
  const started = useRef(false);
  const pasted = useRef(false);
  // The latest callback, for the loader below, which runs once.
  const problemRef = useRef(onProblem);
  useEffect(() => {
    problemRef.current = onProblem;
  });

  useEffect(() => {
    let live = true;
    loadCsvParser()
      .then((p) => {
        if (live) setParse(() => p);
      })
      .catch(() => {
        if (!live) return;
        setLoadFailed(true);
        problemRef.current("loading_failed");
      });
    return () => {
      live = false;
    };
  }, []);

  function begin(source: ImportSource) {
    if (started.current) return;
    started.current = true;
    void track("import_started", { source });
  }

  function fail(problem: Problem, source: ImportSource) {
    const reason = failedReason(problem);
    if (reason) void track("import_failed", { reason, source });
    onProblem(problem);
  }

  function readPasted(input: string) {
    if (!parse) return;
    if (input.trim() === "") {
      // An empty paste box isn't an import.
      onProblem("empty");
      return;
    }
    begin("paste");
    const grid = readText(input, parse, "paste");
    if (typeof grid === "string") return fail(grid, "paste");
    onRead({ source: "paste", tabs: [{ name: "Pasted rows", grid }], fileName: null });
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again reads it again.
    event.target.value = "";
    if (!file || !parse) return;
    const kind = fileKind(file.name, file.type);
    const source: ImportSource = kind === "xlsx" ? "xlsx" : "file";
    begin(source);
    if (kind === "spreadsheet") return fail("unsupported", source);
    if (file.size > MAX_BYTES) return fail("too_big", source);
    setReading(true);
    try {
      const bytes = await file.arrayBuffer();
      // An Excel file saved with another name is read as one.
      if (kind === "xlsx" || sniff(new Uint8Array(bytes.slice(0, 8))) !== "other") {
        const read = await loadXlsxReader().catch(() => null);
        if (!read) return fail("loading_failed", "xlsx");
        const tabs = await readWorkbook(bytes, read, inflateRaw);
        if (typeof tabs === "string") return fail(tabs, "xlsx");
        onRead({ source: "xlsx", tabs, fileName: file.name });
        return;
      }
      const content = decodeText(new Uint8Array(bytes));
      if (content.trim() === "") return fail("empty_file", source);
      const grid = readText(content, parse, "file");
      if (typeof grid === "string") return fail(grid, source);
      onRead({ source: "file", tabs: [{ name: file.name, grid }], fileName: file.name });
    } catch {
      fail("unreadable", source);
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="mt-4">
      {intro && <p className="mb-4 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{intro}</p>}
      <label htmlFor={pasteId} className={labelClass}>
        Paste rows here
      </label>
      <textarea
        id={pasteId}
        value={text}
        rows={4}
        spellCheck={false}
        placeholder={"Item\tQty\tYear installed\tCost"}
        aria-describedby={pasteHintId}
        onPaste={() => {
          pasted.current = true;
        }}
        onChange={(e) => {
          setText(e.target.value);
          // Pasted rows are read straight away; typed ones wait for the button.
          if (pasted.current) {
            pasted.current = false;
            readPasted(e.target.value);
          }
        }}
        className={`${inputClass} mt-1 font-mono text-xs`}
      />
      <p id={pasteHintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Up to 2,000 rows or 5 MB. Excel (.xlsx) and CSV files both work. For .xls, .ods or Numbers files, save as
        .xlsx or CSV first, or copy and paste the rows.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => readPasted(text)} disabled={!parse} className={secondaryButton}>
          {parse || loadFailed ? "Read pasted rows" : "Loading…"}
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">or</span>
        {/* The label is the visible button; the file input inside it keeps the keyboard focus. */}
        <label
          className={`${secondaryButton} cursor-pointer focus-within:ring-2 focus-within:ring-amber-500 ${parse && !reading ? "" : "pointer-events-none opacity-50"}`}
        >
          Choose a file (.xlsx or .csv)
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt,.xls,.ods,.numbers,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={!parse || reading}
            onChange={onFile}
            className="sr-only"
          />
        </label>
        {reading && (
          <span role="status" className="text-sm text-slate-600 dark:text-slate-400">
            Reading your file…
          </span>
        )}
      </div>
    </div>
  );
}
