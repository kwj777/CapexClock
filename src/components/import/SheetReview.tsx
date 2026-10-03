"use client";

import { useId, type Dispatch, type SetStateAction } from "react";
import {
  COLUMN_LAYOUT_FIELDS,
  FIELD_TEXT,
  FIELDS,
  parseRole,
  samples,
  type ColumnRole,
  type Layout,
} from "@/lib/import/columns";
import type { NameMatcher } from "@/lib/import/names";
import { columnsFor, parseSheetYear, type OpenedSheet } from "@/lib/import/open";
import { KEEP_OWN, type FixField, type ImportChoices, type Preview, type PreviewRow } from "@/lib/import/preview";
import { columnLetter, previewHints, quantityAnswers, quantityQuestionText } from "@/lib/import/wording";
import type { LibraryComponent } from "@/verticals/landlord";
import PreviewRows from "./PreviewRows";
import { headingClass, inputClass } from "./SourcePicker";

/** One sheet's choices, and the sheet's year as typed (choices keep it only when it's a year). */
export interface SheetState {
  choices: ImportChoices;
  sheetYearText: string;
}

export interface SheetReviewProps {
  opened: OpenedSheet;
  state: SheetState;
  setState: Dispatch<SetStateAction<SheetState>>;
  preview: Preview;
  library: LibraryComponent[];
  match: NameMatcher;
  currentYear: number;
  /** The preview's summary, read out by the panel's live region when it settles. */
  summary: string;
  /** Rows whose item is already in the list. */
  duplicateIds: ReadonlySet<string>;
  /** What each row does to the list, for a component list download: "Updates: install year from 2012 to 2014". */
  listNotes?: ReadonlyMap<string, string>;
  /** On My properties: a row that needs the owner holds its property back (see PreviewRows). */
  beforeCreate?: boolean;
  /**
   * On My properties, once some of this sheet's properties are created: which building
   * each row is in can't change, so the Building column and the layout stay as they are.
   */
  lockBuildings?: boolean;
}

/**
 * One sheet's columns, questions and preview. The owner can change any column's
 * guess, answer the questions, and fix rows, and the preview follows.
 */
export default function SheetReview({
  opened,
  state,
  setState,
  preview,
  library,
  match,
  currentYear,
  summary,
  duplicateIds,
  listNotes,
  beforeCreate = false,
  lockBuildings = false,
}: SheetReviewProps) {
  const baseId = useId();
  const summaryId = `${baseId}-summary`;
  const sheetYearId = `${baseId}-sheet-year`;
  const { choices, sheetYearText } = state;
  const names = new Map(library.map((c) => [c.slug, c.name]));

  function setChoices(update: (c: ImportChoices) => ImportChoices) {
    setState((s) => ({ ...s, choices: update(s.choices) }));
  }

  function setColumn(index: number, role: ColumnRole) {
    // Choosing Quantity or Ignore for the column the quantity question is about answers it.
    const answers = preview.quantityQuestion?.column === index;
    setChoices((c) => ({
      ...c,
      columns: c.columns.map((r, i) => (i === index ? role : r)),
      quantityAnswered: c.quantityAnswered || answers,
    }));
  }

  function setLayout(layout: Layout) {
    // Fixes were for the other layout's rows, so they start again.
    setChoices((c) => ({ ...c, layout, columns: columnsFor(opened, match, layout, currentYear), fixes: {}, quantityAnswered: false }));
  }

  function setSheetYear(value: string) {
    setState((s) => ({ sheetYearText: value, choices: { ...s.choices, sheetYear: parseSheetYear(value, currentYear) } }));
  }

  /**
   * "quantity": the column is how many of each item. "each_one": it isn't. One number on
   * every row (or every row of each building) is then the building's unit count, so items
   * in every unit take the unit count and the rest count as one. Other numbers number the
   * rows or apartments, so they're left out and each row counts as one.
   */
  function answerQuantity(question: NonNullable<Preview["quantityQuestion"]>, value: "quantity" | "each_one") {
    const role: ColumnRole = value === "quantity" ? "quantity" : question.kind === "numbers" ? "ignore" : "unitCount";
    setChoices((c) => ({
      ...c,
      quantityAnswered: true,
      columns: c.columns.map((r, i) => (i === question.column ? role : r)),
    }));
  }

  function answer(key: string, value: string) {
    setChoices((c) => ({ ...c, answers: { ...c.answers, [key]: value } }));
  }

  function fix(row: PreviewRow, values: Partial<Record<FixField, string>>) {
    setChoices((c) => {
      const fixes = { ...c.fixes };
      for (const key of row.keys) fixes[key] = { ...fixes[key], ...values };
      return { ...c, fixes };
    });
  }

  const sheetYearBad = preview.usesSheetYear && choices.sheetYear === null;
  const columnList = opened.headings
    .map((heading, i) => ({ heading, i, examples: samples(opened.sheet.grid, opened.sheet.headerRow, i) }))
    .filter((c) => c.heading !== "" || c.examples.length > 0);

  return (
    <div className="space-y-6">
      <section aria-labelledby={`${baseId}-columns`}>
        <h4 id={`${baseId}-columns`} className={headingClass}>
          Check the columns
        </h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          We guessed what each column holds. Change any guess, or choose Ignore to leave a column out.
        </p>
        {lockBuildings && (
          <p id={`${baseId}-locked`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Some of these buildings are created, so the Building column and the layout stay as they are.
          </p>
        )}
        {opened.offersColumnLayout && (
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={choices.layout === "columns"}
              disabled={lockBuildings}
              aria-describedby={lockBuildings ? `${baseId}-locked` : undefined}
              onChange={(e) => setLayout(e.target.checked ? "columns" : "rows")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
            />
            <span>
              <span className="font-medium">Each column is a component</span>
              <span className="block text-slate-600 dark:text-slate-400">
                For sheets with a row per apartment and a column per item, like &ldquo;Water heater installed&rdquo;. Each
                apartment&apos;s items become rows, and matching ones are added up.
              </span>
            </span>
          </label>
        )}
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {columnList.map(({ heading, i, examples }) => {
            const selectId = `${baseId}-column-${i}`;
            const fixed = lockBuildings && choices.columns[i] === "building";
            return (
              <li key={i} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
                <div className="min-w-0">
                  <label htmlFor={selectId} className="block text-sm font-medium wrap-anywhere text-slate-900 dark:text-white">
                    <span className="mr-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">{columnLetter(i)}</span>
                    {heading || "(no heading)"}
                  </label>
                  {examples.length > 0 && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">e.g. {examples.join(", ")}</p>
                  )}
                </div>
                {/* Named in full here: hidden words inside the label are read as their own block, with a stray space. */}
                <select
                  id={selectId}
                  aria-label={`Column ${columnLetter(i)}, ${heading || "(no heading)"}`}
                  value={choices.columns[i] ?? "ignore"}
                  disabled={fixed}
                  aria-describedby={fixed ? `${baseId}-locked` : undefined}
                  onChange={(e) => setColumn(i, parseRole(e.target.value))}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-300`}
                >
                  <option value="ignore">Ignore</option>
                  {(choices.layout === "columns" ? COLUMN_LAYOUT_FIELDS : FIELDS).map((f) => (
                    <option key={f} value={f} disabled={lockBuildings && f === "building"}>
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
                  onChange={() => preview.quantityQuestion && answerQuantity(preview.quantityQuestion, value)}
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
            We weren&apos;t sure, so we haven&apos;t matched them.{" "}
            {beforeCreate
              ? "Answer each one, or keep it as its own item, before creating the properties."
              : "Any you leave are added as their own items."}
          </p>
          <div className="mt-2 space-y-3">
            {preview.questions.map((q, qi) => (
              <fieldset key={q.key} className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <legend className="sr-only">{`"${q.text}", ${q.rows} ${q.rows === 1 ? "row" : "rows"}`}</legend>
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
            duplicateIds={duplicateIds}
            listNotes={listNotes}
            fallbackFocusId={summaryId}
            onFix={fix}
            beforeCreate={beforeCreate}
          />
        </div>
      </section>
    </div>
  );
}
