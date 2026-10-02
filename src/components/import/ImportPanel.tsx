"use client";

import { useEffect, useId, useMemo, useRef, useState, type SetStateAction } from "react";
import type { Draft, DraftImport } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { createMatcher } from "@/lib/import/names";
import { startingChoices, type OpenedSheet } from "@/lib/import/open";
import { buildPreview, type Preview } from "@/lib/import/preview";
import { failedReason, PROBLEM_TEXT, type FailReason, type Problem } from "@/lib/import/read";
import {
  applyLabel,
  askText,
  changedCount,
  doneText,
  fillText,
  importSummary,
  knownRows,
  listNotes,
  planImport,
  planSummary,
  removeText,
  sheetDetails,
} from "@/lib/import/reimport";
import { openTabs, startingTabs, tabNote, tabRowCounts, type OpenedTab } from "@/lib/import/tabs";
import { duplicates, duplicateText, longListText } from "@/lib/import/wording";
import type { LibraryComponent } from "@/lib/library/components";
import SheetReview, { type SheetState } from "./SheetReview";
import SourcePicker, { headingClass, inputClass, labelClass, secondaryButton, type SourceRead } from "./SourcePicker";
import TemplateLink from "./TemplateLink";

export type ImportWhere = "calculator" | "editor" | "template_page";

export interface ImportPanelProps {
  id: string;
  library: LibraryComponent[];
  /** The list the rows go into: its rows (for duplicates and CapexClock IDs), unit count and year built. */
  draft: Pick<Draft, "rows" | "unitCount" | "yearBuilt">;
  /** Applies the import; `said` is what to tell the owner it did. */
  onApply: (change: DraftImport, said: string) => void;
  onClose: () => void;
  /** Where the panel is, for the events and what it says about several buildings. */
  where: ImportWhere;
  /** Accounts are on, so a sheet of several buildings can point to My properties. */
  accountsEnabled?: boolean;
}

/**
 * Reads rows pasted from a spreadsheet, a CSV file or an Excel file, in this
 * browser, into one list. Nothing is uploaded, and the panel is kept out of
 * PostHog's click capture (ph-no-capture). A component list download updates the
 * rows its CapexClock IDs match. Nothing changes until the owner clicks the button.
 */
export default function ImportPanel({ id, library, draft, onApply, onClose, where, accountsEnabled = false }: ImportPanelProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const [currentYear] = useState(() => new Date().getFullYear());
  const match = useMemo(() => createMatcher(library), [library]);
  const [read, setRead] = useState<SourceRead | null>(null);
  const [tabs, setTabs] = useState<OpenedTab[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [removeMissing, setRemoveMissing] = useState(false);
  // The owner's answers to "Change rental units from 14 to 12?"; missing means the default.
  const [detailAnswers, setDetailAnswers] = useState<Partial<Record<"unitCount" | "yearBuilt", boolean>>>({});
  const [announcement, setAnnouncement] = useState("");
  const previewed = useRef<OpenedSheet | null>(null);

  const tabRows = useMemo(() => tabRowCounts(tabs, library, match, currentYear), [tabs, library, match, currentYear]);
  const opened = sheet ? tabs[tabIndex] : undefined;
  const openedSheet = typeof opened === "object" ? opened : null;
  const known = useMemo(() => knownRows(draft.rows), [draft.rows]);

  // A sheet of several buildings shows one at a time: the chosen one, or the first.
  const result = useMemo((): { preview: Preview; building: string | null } | null => {
    if (!openedSheet || !sheet) return null;
    const build = (building: string | null) =>
      buildPreview(openedSheet.sheet, { ...sheet.choices, building }, library, match, currentYear, known);
    const chosen = sheet.choices.building ?? null;
    const first = build(chosen);
    const keys = first.buildings.map((b) => b.key);
    const want = keys.length > 1 ? (chosen !== null && keys.includes(chosen) ? chosen : keys[0]) : null;
    return { preview: want === chosen ? first : build(want), building: want };
  }, [openedSheet, sheet, library, match, currentYear, known]);
  const preview = result?.preview ?? null;

  const plan = useMemo(() => (preview ? planImport(preview.rows, draft.rows) : null), [preview, draft.rows]);
  const notes = useMemo(() => (plan ? listNotes(plan) : undefined), [plan]);
  const added = useMemo(
    () => (preview && plan ? preview.rows.filter((r) => plan.byPreviewRow.get(r.id)?.kind === "add") : []),
    [preview, plan],
  );
  const dup = useMemo(() => duplicates(draft.rows, added), [draft.rows, added]);
  const building = preview?.buildings.find((b) => b.key === (result?.building ?? "")) ?? (preview?.buildings.length === 1 ? preview.buildings[0] : undefined);
  const details = sheetDetails(building, draft);

  // Counts only: never names or anything from the sheet.
  useEffect(() => {
    if (!openedSheet || !preview || !read || previewed.current === openedSheet) return;
    previewed.current = openedSheet;
    const { rows, ready, changed, needsYou, skipped } = preview.counts;
    void track("import_previewed", { rows, ready, flagged: changed + needsYou, skipped, source: read.source });
  }, [openedSheet, preview, read]);

  // Screen readers hear the summary once choices settle, not on every key press. A
  // component list download's says what it updates, adds and removes.
  const summary = preview && plan ? importSummary(preview.counts, plan, removeMissing) : "";
  useEffect(() => {
    if (!summary) return;
    const timer = window.setTimeout(
      () => setAnnouncement((current) => (current === summary ? `${summary} ` : summary)),
      600,
    );
    return () => window.clearTimeout(timer);
  }, [summary, openedSheet]);

  function failOpen(reason: FailReason, source: SourceRead["source"]) {
    setSheet(null);
    setProblem(reason);
    const sent = failedReason(reason);
    if (sent) void track("import_failed", { reason: sent, source, where });
  }

  function showTab(list: OpenedTab[], index: number) {
    const tab = list[index];
    if (typeof tab !== "object") return;
    setTabIndex(index);
    setSheet({ choices: startingChoices(tab, currentYear), sheetYearText: String(currentYear) });
    setRemoveMissing(false);
    setDetailAnswers({});
  }

  function onRead(next: SourceRead) {
    const list = openTabs(next.tabs, match, currentYear);
    setRead(next);
    setTabs(list);
    const first = startingTabs(next.tabs, list)[0] ?? -1;
    if (first < 0) {
      const reason = list[0];
      return failOpen(typeof reason === "string" && list.length === 1 ? reason : "no_header", next.source);
    }
    setProblem(null);
    showTab(list, first);
  }

  function onProblem(next: Problem) {
    setSheet(null);
    setProblem(next);
  }

  function setState(update: SetStateAction<SheetState>) {
    setSheet((s) => (s ? (typeof update === "function" ? update(s) : update) : s));
  }

  const sheetYearBad = preview?.usesSheetYear === true && sheet?.choices.sheetYear === null;
  const takesDetail = (field: "unitCount" | "yearBuilt") => detailAnswers[field] ?? plan?.matched === true;
  const label = plan ? applyLabel(plan, removeMissing) : null;
  const detailsChange = details.fill.length > 0 || details.ask.some((a) => takesDetail(a.field));
  const canApply = preview !== null && plan !== null && !sheetYearBad && (label !== null || detailsChange);

  function apply() {
    if (!plan || !canApply || !read) return;
    const values = [...details.fill, ...details.ask.filter((a) => takesDetail(a.field))];
    const remove = removeMissing ? plan.missing.map((m) => m.id) : [];
    void track("import_completed", {
      rows_added: plan.add.length,
      rows_updated: changedCount(plan),
      rows_removed: remove.length,
      source: read.source,
      where,
    });
    const said = label === null ? "Updated the building details from your spreadsheet." : doneText(plan, remove.length);
    onApply(
      {
        add: plan.add,
        update: plan.update.map(({ id: rowId, row }) => ({ id: rowId, row })),
        remove,
        ...Object.fromEntries(values.map((v) => [v.field, v.value])),
      },
      said,
    );
  }

  const rowsAfter = draft.rows.length - (removeMissing ? (plan?.missing.length ?? 0) : 0);
  const longList = plan ? longListText(rowsAfter, plan.add.length) : "";
  const unanswered =
    (preview?.questions.filter((q) => sheet?.choices.answers[q.key] === undefined).length ?? 0) +
    (preview?.unitsQuestion?.answer === null ? 1 : 0);
  const usable = tabs.filter((t) => typeof t === "object").length;
  const anyHidden = read?.tabs.some((t) => t.hidden) ?? false;
  const summaryLines = plan ? planSummary(plan) : [];

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
        Copy your rows from Excel or Google Sheets, headings included, and paste them below. Or choose an Excel or CSV
        file. Your sheet is read in this browser and never uploaded.
      </p>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Starting from scratch? <TemplateLink file="template" where={`import_${where}`} />. A component list you
        downloaded here updates your rows when you import it again.
      </p>

      <SourcePicker onRead={onRead} onProblem={onProblem} />

      {problem && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {PROBLEM_TEXT[problem]}
        </p>
      )}

      {read && sheet && openedSheet && preview && plan && (
        <div className="mt-6 space-y-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          {read.tabs.length > 1 && (
            <fieldset>
              <legend className={headingClass}>Which tab?</legend>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {usable > 1 ? "This file has more than one tab. Choose the one to import." : "We'll import the only tab with headings."}
                {anyHidden && usable > 1 ? " Tabs hidden in your spreadsheet are marked hidden, and we start with one that isn't." : ""}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {read.tabs.map((tab, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                    <input
                      type="radio"
                      name={`${baseId}-tab`}
                      checked={tabIndex === i}
                      disabled={typeof tabs[i] !== "object"}
                      onChange={() => showTab(tabs, i)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                    />
                    <span className="wrap-anywhere">
                      {tab.name} <span className="text-slate-500 dark:text-slate-400">({tabNote(tab, tabs[i], tabRows[i] ?? null)})</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {preview.buildings.length > 1 && (
            <div>
              <label htmlFor={`${baseId}-building`} className={headingClass}>
                Which building?
              </label>
              <p id={`${baseId}-building-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This sheet has {preview.buildings.length} buildings.{" "}
                {where === "editor"
                  ? "A property holds one, so choose the one to import. To make a property of each, use Import on My properties."
                  : `The calculator takes one at a time.${accountsEnabled ? " Signed in, you can make a property of each from My properties." : ""}`}
              </p>
              <select
                id={`${baseId}-building`}
                value={result?.building ?? ""}
                aria-describedby={`${baseId}-building-hint`}
                onChange={(e) => setState((s) => ({ ...s, choices: { ...s.choices, building: e.target.value } }))}
                className={`${inputClass} mt-2 sm:max-w-sm`}
              >
                {preview.buildings.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name || "Rows with no building"} ({b.records} {b.records === 1 ? "row" : "rows"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <SheetReview
            opened={openedSheet}
            state={sheet}
            setState={setState}
            preview={preview}
            library={library}
            match={match}
            currentYear={currentYear}
            summary={summary}
            duplicateIds={dup.ids}
            listNotes={notes}
          />

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            {(details.fill.length > 0 || details.ask.length > 0 || (building?.notes.length ?? 0) > 0) && (
              <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {details.fill.length > 0 && <p>{fillText(details.fill)}</p>}
                {details.ask.map((a) => (
                  <label key={a.field} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={takesDetail(a.field)}
                      onChange={(e) => setDetailAnswers((d) => ({ ...d, [a.field]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                    />
                    {askText(a)}
                  </label>
                ))}
                {building?.notes.map((n) => (
                  <p key={n} className="text-amber-800 dark:text-amber-300">
                    {n}
                  </p>
                ))}
              </div>
            )}
            {summaryLines.length > 0 && (
              <div className="rounded-lg bg-white p-3 text-sm text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                {summaryLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {plan.missing.length > 0 && (
                  <>
                    <label className="mt-2 flex items-start gap-2 font-medium wrap-anywhere">
                      <input
                        type="checkbox"
                        checked={removeMissing}
                        aria-describedby={`${baseId}-remove-hint`}
                        onChange={(e) => setRemoveMissing(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                      />
                      {removeText(plan.missing)}
                    </label>
                    <p id={`${baseId}-remove-hint`} className={`${labelClass} mt-1 pl-6`}>
                      Left unticked, they stay in your list.
                    </p>
                  </>
                )}
              </div>
            )}
            {dup.names.length > 0 && (
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
                onClick={apply}
                disabled={!canApply}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {label ?? (detailsChange ? "Update the building details" : "Nothing to change")}
              </button>
              <button type="button" onClick={onClose} className={secondaryButton}>
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {plan.matched
                ? "Rows with a CapexClock ID are changed in place. New rows go after the ones you already have."
                : "Adding puts these rows after the ones you already have. It doesn't replace anything."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
