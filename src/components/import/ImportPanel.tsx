"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { DraftRow } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import {
  COLUMN_LAYOUT_FIELDS,
  FIELD_TEXT,
  FIELDS,
  parseRole,
  samples,
  type ColumnRole,
  type Layout,
} from "@/lib/import/columns";
import { createMatcher } from "@/lib/import/names";
import { columnsFor, openSheet, parseSheetYear, startingChoices, type OpenedSheet } from "@/lib/import/open";
import {
  buildPreview,
  KEEP_OWN,
  type FixField,
  type ImportChoices,
  type ImportedRow,
  type PreviewRow,
} from "@/lib/import/preview";
import {
  decodeText,
  failedReason,
  fileKind,
  MAX_BYTES,
  PROBLEM_TEXT,
  readText,
  type CsvParse,
  type ImportSource,
  type Problem,
} from "@/lib/import/read";
import {
  addLabel,
  columnLetter,
  duplicates,
  duplicateText,
  longListText,
  previewHints,
  previewSummary,
  quantityAnswers,
  quantityQuestionText,
} from "@/lib/import/wording";
import type { LibraryComponent } from "@/lib/library/components";
import { loadCsvParser } from "./csv";
import PreviewRows from "./PreviewRows";

const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
const headingClass = "text-sm font-semibold text-slate-950 dark:text-white";
const secondaryButton =
  "rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800";

export interface ImportPanelProps {
  id: string;
  library: LibraryComponent[];
  /** The draft's rows, to warn about items already in the list. */
  draftRows: readonly Pick<DraftRow, "librarySlug" | "name">[];
  onAdd: (rows: ImportedRow[]) => void;
  onClose: () => void;
}

/**
 * Reads rows pasted from a spreadsheet, or a CSV file, in this browser. Nothing is
 * uploaded, and the panel is kept out of PostHog's click capture (ph-no-capture).
 * Rows go into the draft only when the owner clicks Add.
 */
export default function ImportPanel({ id, library, draftRows, onAdd, onClose }: ImportPanelProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const pasteId = `${baseId}-paste`;
  const pasteHintId = `${baseId}-paste-hint`;
  const summaryId = `${baseId}-summary`;
  const sheetYearId = `${baseId}-sheet-year`;
  const [currentYear] = useState(() => new Date().getFullYear());
  const match = useMemo(() => createMatcher(library), [library]);
  const names = useMemo(() => new Map(library.map((c) => [c.slug, c.name])), [library]);
  const [parse, setParse] = useState<CsvParse | null>(null);
  const [text, setText] = useState("");
  const [opened, setOpened] = useState<OpenedSheet | null>(null);
  const [choices, setChoices] = useState<ImportChoices | null>(null);
  const [sheetYearText, setSheetYearText] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const started = useRef(false);
  const pasted = useRef(false);
  const previewed = useRef<OpenedSheet | null>(null);

  useEffect(() => {
    let live = true;
    loadCsvParser()
      .then((p) => {
        if (live) setParse(() => p);
      })
      .catch(() => {
        if (live) setProblem("loading_failed");
      });
    return () => {
      live = false;
    };
  }, []);

  const preview = useMemo(
    () => (opened && choices ? buildPreview(opened.sheet, choices, library, match, currentYear) : null),
    [opened, choices, library, match, currentYear],
  );
  const dup = useMemo(() => (preview ? duplicates(draftRows, preview.rows) : null), [draftRows, preview]);

  // Counts only: never names or anything from the sheet.
  useEffect(() => {
    if (!opened || !preview || previewed.current === opened) return;
    previewed.current = opened;
    const { rows, ready, changed, needsYou, skipped } = preview.counts;
    void track("import_previewed", { rows, ready, flagged: changed + needsYou, skipped });
  }, [opened, preview]);

  // Screen readers hear the summary once choices settle, not on every key press.
  const summary = preview ? previewSummary(preview.counts) : "";
  useEffect(() => {
    if (!summary) return;
    const timer = window.setTimeout(
      () => setAnnouncement((current) => (current === summary ? `${summary} ` : summary)),
      600,
    );
    return () => window.clearTimeout(timer);
  }, [summary, opened]);

  function begin(source: ImportSource) {
    if (started.current) return;
    started.current = true;
    void track("import_started", { source });
  }

  function fail(problem: Problem) {
    setOpened(null);
    setChoices(null);
    setProblem(problem);
    const reason = failedReason(problem);
    if (reason) void track("import_failed", { reason });
  }

  function read(input: string, source: ImportSource) {
    if (!parse) return;
    if (input.trim() === "") {
      // A chosen file started an import; an empty paste box didn't.
      fail(source === "file" ? "empty_file" : "empty");
      return;
    }
    begin(source);
    const grid = readText(input, parse, source);
    if (typeof grid === "string") return fail(grid);
    const result = openSheet(grid, match, currentYear);
    if (typeof result === "string") return fail(result);
    setProblem(null);
    setOpened(result);
    setChoices(startingChoices(result, currentYear));
    setSheetYearText(String(currentYear));
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again reads it again.
    event.target.value = "";
    if (!file || !parse) return;
    begin("file");
    if (fileKind(file.name, file.type) === "spreadsheet") return fail("unsupported");
    if (file.size > MAX_BYTES) return fail("too_big");
    let content: string;
    try {
      // Excel on Windows saves CSV files in its own encoding, not UTF-8.
      content = decodeText(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return fail("unreadable");
    }
    read(content, "file");
  }

  function setColumn(index: number, role: ColumnRole) {
    // Choosing Quantity or Ignore for the column the quantity question is about answers it.
    const answers = preview?.quantityQuestion?.column === index;
    setChoices(
      (c) =>
        c && {
          ...c,
          columns: c.columns.map((r, i) => (i === index ? role : r)),
          quantityAnswered: c.quantityAnswered || answers,
        },
    );
  }

  function setLayout(layout: Layout) {
    if (!opened) return;
    // Fixes were for the other layout's rows, so they start again.
    setChoices((c) => c && { ...c, layout, columns: columnsFor(opened, match, layout, currentYear), fixes: {}, quantityAnswered: false });
  }

  function setSheetYear(value: string) {
    setSheetYearText(value);
    setChoices((c) => c && { ...c, sheetYear: parseSheetYear(value, currentYear) });
  }

  /** "quantity": the column is how many of each item; "each_one": it isn't, so each row counts as one. */
  function answerQuantity(column: number, value: "quantity" | "each_one") {
    setChoices(
      (c) =>
        c && {
          ...c,
          quantityAnswered: true,
          columns: c.columns.map((r, i) => (i === column ? (value === "quantity" ? "quantity" : "ignore") : r)),
        },
    );
  }

  function answer(key: string, value: string) {
    setChoices((c) => c && { ...c, answers: { ...c.answers, [key]: value } });
  }

  function fix(row: PreviewRow, values: Partial<Record<FixField, string>>) {
    setChoices((c) => {
      if (!c) return c;
      const fixes = { ...c.fixes };
      for (const key of row.keys) fixes[key] = { ...fixes[key], ...values };
      return { ...c, fixes };
    });
  }

  const sheetYearBad = preview?.usesSheetYear === true && choices?.sheetYear === null;
  const canAdd = preview !== null && preview.rows.length > 0 && !sheetYearBad;

  function add() {
    if (!preview || !canAdd) return;
    const rows = preview.rows.map((r) => r.row);
    void track("import_completed", { rows_added: rows.length });
    onAdd(rows);
  }

  const columnList = opened
    ? opened.headings
        .map((heading, i) => ({ heading, i, examples: samples(opened.sheet.grid, opened.sheet.headerRow, i) }))
        .filter((c) => c.heading !== "" || c.examples.length > 0)
    : [];
  const unanswered =
    (preview?.questions.filter((q) => choices?.answers[q.key] === undefined).length ?? 0) +
    (preview?.quantityQuestion?.answer === null ? 1 : 0);
  const longList = preview ? longListText(draftRows.length, preview.rows.length) : "";

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="ph-no-capture mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-950/40"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="text-base font-semibold text-slate-950 dark:text-white">
          Import from a spreadsheet
        </h3>
        <button type="button" onClick={onClose} className={secondaryButton}>
          Close
        </button>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Copy your rows from Excel or Google Sheets, headings included, and paste them below. Or choose a CSV file.
        Your sheet is read in this browser and never uploaded.
      </p>

      <div className="mt-4">
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
              read(e.target.value, "paste");
            }
          }}
          className={`${inputClass} mt-1 font-mono text-xs`}
        />
        <p id={pasteHintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Up to 2,000 rows or 5 MB. Have an Excel file? Save it as CSV first, or copy and paste the rows.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => read(text, "paste")} disabled={!parse} className={secondaryButton}>
            {parse || problem === "loading_failed" ? "Read pasted rows" : "Loading…"}
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">or</span>
          {/* The label is the visible button; the file input inside it keeps the keyboard focus. */}
          <label
            className={`${secondaryButton} cursor-pointer focus-within:ring-2 focus-within:ring-amber-500 ${parse ? "" : "pointer-events-none opacity-50"}`}
          >
            Choose a CSV file
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              disabled={!parse}
              onChange={onFile}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {problem && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {PROBLEM_TEXT[problem]}
        </p>
      )}

      {opened && choices && preview && (
        <div className="mt-6 space-y-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <section aria-labelledby={`${baseId}-columns`}>
            <h4 id={`${baseId}-columns`} className={headingClass}>
              Check the columns
            </h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              We guessed what each column holds. Change any guess, or choose Ignore to leave a column out.
            </p>
            {opened.offersColumnLayout && (
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={choices.layout === "columns"}
                  onChange={(e) => setLayout(e.target.checked ? "columns" : "rows")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                />
                <span>
                  <span className="font-medium">Each column is a component</span>
                  <span className="block text-slate-600 dark:text-slate-400">
                    For sheets with a row per apartment and a column per item, like &ldquo;Water heater
                    installed&rdquo;. Each apartment&apos;s items become rows, and matching ones are added up.
                  </span>
                </span>
              </label>
            )}
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {columnList.map(({ heading, i, examples }) => {
                const selectId = `${baseId}-column-${i}`;
                return (
                  <li key={i} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
                    <div className="min-w-0">
                      <label htmlFor={selectId} className="block text-sm font-medium wrap-anywhere text-slate-900 dark:text-white">
                        <span className="sr-only">Column </span>
                        <span className="mr-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                          {columnLetter(i)}
                        </span>
                        <span className="sr-only">, </span>
                        {heading || "(no heading)"}
                      </label>
                      {examples.length > 0 && (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">e.g. {examples.join(", ")}</p>
                      )}
                    </div>
                    <select
                      id={selectId}
                      value={choices.columns[i] ?? "ignore"}
                      onChange={(e) => setColumn(i, parseRole(e.target.value))}
                      className={inputClass}
                    >
                      <option value="ignore">Ignore</option>
                      {(choices.layout === "columns" ? COLUMN_LAYOUT_FIELDS : FIELDS).map((f) => (
                        <option key={f} value={f}>
                          {FIELD_TEXT[f]}
                        </option>
                      ))}
                      {choices.layout === "columns" && (
                        <optgroup label="A component (cells are install years)">
                          {library.map((c) => (
                            <option key={c.slug} value={`component:${c.slug}`}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>

          {preview.usesSheetYear && (
            <div>
              <label htmlFor={sheetYearId} className={headingClass}>
                What year was this sheet last updated?
              </label>
              <p id={`${sheetYearId}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                We count ages, years left and replace-by years from it, and mark those install years as guesses.
              </p>
              <input
                id={sheetYearId}
                inputMode="numeric"
                value={sheetYearText}
                onChange={(e) => setSheetYear(e.target.value)}
                aria-invalid={sheetYearBad || undefined}
                aria-describedby={`${sheetYearId}-hint${sheetYearBad ? ` ${sheetYearId}-error` : ""}`}
                className={`${inputClass} mt-2 w-32 tabular-nums`}
              />
              {sheetYearBad && (
                <p id={`${sheetYearId}-error`} className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  Type a 4-digit year from 1900 to {currentYear}.
                </p>
              )}
            </div>
          )}

          {preview.quantityQuestion && (
            <fieldset>
              <legend className={`${headingClass} wrap-anywhere`}>{quantityQuestionText(preview.quantityQuestion)}</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {quantityAnswers(preview.quantityQuestion).map(([value, text]) => (
                  <label key={value} className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name={`${baseId}-quantity`}
                      value={value}
                      checked={preview.quantityQuestion?.answer === value}
                      onChange={() => preview.quantityQuestion && answerQuantity(preview.quantityQuestion.column, value)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {preview.questions.length > 0 && (
            <section aria-labelledby={`${baseId}-questions`}>
              <h4 id={`${baseId}-questions`} className={headingClass}>
                Which items are these?
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                We weren&apos;t sure, so we haven&apos;t matched them. Any you leave are added as their own items.
              </p>
              <div className="mt-2 space-y-3">
                {preview.questions.map((q, qi) => (
                  <fieldset key={q.key} className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <legend className="sr-only">
                      {`"${q.text}", ${q.rows} ${q.rows === 1 ? "row" : "rows"}`}
                    </legend>
                    <p aria-hidden="true" className="text-sm font-medium wrap-anywhere text-slate-900 dark:text-white">
                      &ldquo;{q.text}&rdquo;{" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        ({q.rows} {q.rows === 1 ? "row" : "rows"})
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {[...q.suggestions, KEEP_OWN].map((value) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                          <input
                            type="radio"
                            name={`${baseId}-question-${qi}`}
                            value={value}
                            checked={choices.answers[q.key] === value}
                            onChange={() => answer(q.key, value)}
                            className="h-4 w-4 accent-amber-500"
                          />
                          {value === KEEP_OWN ? `Keep it as its own item` : names.get(value)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby={`${baseId}-preview`}>
            <h4 id={`${baseId}-preview`} className={headingClass}>
              Preview
            </h4>
            <p id={summaryId} tabIndex={-1} className="mt-1 text-sm font-medium text-slate-900 focus:outline-none dark:text-white">
              {summary}
            </p>
            {previewHints(preview).map((hint) => (
              <p key={hint} className="mt-1 text-sm wrap-anywhere text-slate-600 dark:text-slate-400">
                {hint}
              </p>
            ))}
            <div className="mt-4">
              <PreviewRows
                preview={preview}
                duplicateIds={dup?.ids ?? new Set<string>()}
                fallbackFocusId={summaryId}
                onFix={fix}
              />
            </div>
          </section>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            {dup && dup.names.length > 0 && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm wrap-anywhere text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                {duplicateText(dup.names)}
              </p>
            )}
            {longList && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                {longList}
              </p>
            )}
            {(preview.counts.needsYou > 0 || unanswered > 0) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Rows that need you are added as they are, and the calculator shows what to fix.
              </p>
            )}
            {sheetYearBad && (
              <p className="text-sm text-amber-800 dark:text-amber-300">Fix the year the sheet was last updated to add these rows.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addLabel(preview.rows.length)}
              </button>
              <button type="button" onClick={onClose} className={secondaryButton}>
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adding puts these rows after the ones you already have. It doesn&apos;t replace anything.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
