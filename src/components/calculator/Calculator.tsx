"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import ComponentListButton from "@/components/export/ComponentListButton";
import ExportButtons from "@/components/export/ExportButtons";
import PaidIdeaButton, { PaidIdeaDisclosure } from "@/components/paid/PaidIdeaButton";
import PaidIdeasProvider from "@/components/paid/PaidIdeas";
import { track } from "@/lib/analytics";
import { moneyColumn } from "@/lib/export/format";
import { guessedYear, installYearNote } from "@/lib/export/rows";
import type { PaidWhere } from "@/lib/paid-ideas";
import {
  badYearBuilt,
  COMPONENT_LIBRARY,
  CONDITION_TEXT,
  CONDITIONS,
  costLabel,
  customRow,
  detailsShown,
  detailsSummary,
  editRow,
  EMPTY_DRAFT,
  exampleDraft,
  forecastDraft,
  groupByCategory,
  hasEntries,
  importReplaces,
  MAX_NOTES_LENGTH,
  neighborRowId,
  notesLeftText,
  notesTooLong,
  problemFields,
  problemText,
  rowFromLibrary,
  rowTotal,
  TYPICAL_COSTS,
  UNIT_LABEL_TEXT,
  withImport,
  withUnitCount,
  YEAR_BUILT_TEXT,
  type Draft,
  type DraftImport,
  type DraftRow,
  type LandlordForecast,
  type LibraryComponent,
  type RowField,
  type RowProblem,
  type TypicalCost,
} from "@/verticals/landlord";
import { forecastSummary } from "./announce";
import { toChartRows } from "./chartData";
import { NEW_COMPARE_STATE, riskText, type CompareState } from "./compare";
import CompareAtRisk from "./CompareAtRisk";
import { costHint } from "./cost-hint";
import {
  clearImportUndo,
  loadDraft,
  peekImportUndo,
  saveDraft,
  STORAGE_KEY as DRAFT_STORAGE_KEY,
} from "./draft-storage";
import { formatMoney, formatReserve, formatUnitPrice } from "./format";

// Recharts is big; load it only once there's a forecast to draw.
const ForecastChart = dynamic(() => import("./ForecastChart"), {
  ssr: false,
  loading: () => <div className="h-72 w-full sm:h-80" />,
});

// The importer (and the CSV reader it loads) only once the owner opens it.
const ImportPanel = dynamic(() => import("@/components/import/ImportPanel"), {
  ssr: false,
  loading: () => <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading the importer…</p>,
});

const CUSTOM = "__custom__";
// Plans a replacement this year. Not "now", which reads like "I just replaced it".
const REPLACE_LABEL = "Replace this year";

const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
/** Lets the browser skip drawing a row that's out of view, sized as it last looked. */
const offscreenClass =
  "[content-visibility:auto] [contain-intrinsic-block-size:auto_400px] sm:[contain-intrinsic-block-size:auto_288px] lg:[contain-intrinsic-block-size:auto_96px]";
// Shared by the column headings and every row so they line up on wide screens. Cost is the
// widest number column, since its note ("Typical $2,500–$5,000, use your quote") is longest.
const rowGridClass =
  "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.9fr)_6.5rem_4.5rem]";
const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";
const textButton =
  "text-left text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300";

/** The public calculator: work is kept in this browser until it's saved to an account. */
export default function Calculator({
  accountsEnabled = false,
  library = COMPONENT_LIBRARY,
  typicalCosts = TYPICAL_COSTS,
}: {
  accountsEnabled?: boolean;
  library?: LibraryComponent[];
  typicalCosts?: TypicalCost[];
}) {
  // Rendered client-only (see CalculatorLoader), so browser APIs are safe here.
  // An import on the template page that changed the list leaves a copy to undo.
  const [start] = useState(() => {
    const loaded = loadDraft();
    const before = peekImportUndo(loaded, new Date().getFullYear());
    return { draft: loaded, undo: before ? { before, after: loaded, action: "import" as const } : null };
  });
  const [draft, setDraft] = useState<Draft>(start.draft);
  // The Save box steps back while the pay question is asked, so the question isn't lost next to it.
  const [askingPay, setAskingPay] = useState(false);
  useEffect(() => saveDraft(draft), [draft]);
  // Offered once: a reload or a later visit doesn't offer it again.
  useEffect(() => clearImportUndo(), []);
  // Follow changes from other tabs, e.g. this work being saved to an account and cleared.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DRAFT_STORAGE_KEY || event.key === null) setDraft(loadDraft());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <CalculatorView
      draft={draft}
      setDraft={setDraft}
      library={library}
      typicalCosts={typicalCosts}
      trackEvents
      showExample
      accountsEnabled={accountsEnabled}
      initialUndo={start.undo}
      lookUpOwnerEmail={accountsEnabled}
      onPayQuestionChange={setAskingPay}
      footer={accountsEnabled && draft.rows.length > 0 ? <SaveToAccount quiet={askingPay} /> : null}
    />
  );
}

/** Quiet while another question on the page waits for an answer: still there, but not competing with it. */
function SaveToAccount({ quiet = false }: { quiet?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ring-1 ${
        quiet
          ? "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          : "bg-amber-50 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
      }`}
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Save this property to a free account to keep it, add more buildings and see your whole
        portfolio.
      </p>
      <Link
        href="/app/properties/new?from=calculator"
        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
          quiet
            ? "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
            : "bg-amber-500 text-slate-950 hover:bg-amber-400"
        }`}
      >
        Save to my account
      </Link>
    </div>
  );
}

export interface CalculatorViewProps {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  /** Sends calculator_started / forecast_generated (public calculator only). */
  trackEvents?: boolean;
  showExample?: boolean;
  /** Extra controls shown above the property fields, e.g. a property name. */
  header?: ReactNode;
  footer?: ReactNode;
  /** Title for exported files. */
  exportName?: string;
  /** The property's name for the component list's Building column; blank in the public calculator. */
  listName?: string;
  /** Where the importer is, for its events and what it says about several buildings. */
  importWhere?: "calculator" | "editor";
  /** Accounts are on, so the importer can point a sheet of several buildings to My properties. */
  accountsEnabled?: boolean;
  /** Components offered in the picker; defaults to the built-in library. */
  library?: LibraryComponent[];
  /** Typical costs shown as hints under the cost fields; defaults to the built-in list. */
  typicalCosts?: TypicalCost[];
  /** Told while the pay question after a download waits for an answer. */
  onPayQuestionChange?: (asking: boolean) => void;
  /**
   * Notes by row id that replace the row's forecast note, e.g. why it can't be saved,
   * with the fields they're about (marked invalid and pointed at the note).
   */
  rowNotes?: Record<string, RowNote>;
  /** An undo to offer from the start: an import on the template page that changed the list. */
  initialUndo?: Undo | null;
  /** The page, for the paid-idea buttons' events and sign-ups. */
  where?: PaidWhere;
  /** The signed-in owner's email, filled in on the paid-idea "tell me first" forms. */
  ownerEmail?: string | null;
  /** Look up a signed-in owner's email in this browser when a paid-idea panel opens. */
  lookUpOwnerEmail?: boolean;
}

/** What Load an example, Clear or an import replaced, and the list it left. */
interface Undo {
  before: Draft;
  after: Draft;
  action: "clear" | "example" | "import";
}

/** A note shown under a row, and the row's fields it's about. */
export interface RowNote {
  text: string;
  fields: RowField[];
}

export function CalculatorView({
  where = "calculator",
  ownerEmail,
  lookUpOwnerEmail = false,
  ...props
}: CalculatorViewProps) {
  return (
    <PaidIdeasProvider where={where} ownerEmail={ownerEmail} lookUpOwnerEmail={lookUpOwnerEmail}>
      <CalculatorBody {...props} />
    </PaidIdeasProvider>
  );
}

function CalculatorBody({
  draft,
  setDraft,
  trackEvents = false,
  showExample = false,
  header,
  footer,
  exportName = "My property",
  listName = "",
  importWhere = "calculator",
  accountsEnabled = false,
  library = COMPONENT_LIBRARY,
  typicalCosts = TYPICAL_COSTS,
  rowNotes,
  initialUndo = null,
  onPayQuestionChange,
}: Omit<CalculatorViewProps, "where" | "ownerEmail" | "lookUpOwnerEmail">) {
  const libraryBySlug = useMemo(() => new Map(library.map((c) => [c.slug, c])), [library]);
  const typicalBySlug = useMemo(() => new Map(typicalCosts.map((c) => [c.slug, c])), [typicalCosts]);
  const libraryGroups = useMemo(() => groupByCategory(library), [library]);
  const [startYear] = useState(() => new Date().getFullYear());
  const tracked = useRef({ started: !trackEvents || draft.rows.length > 0 });
  const baseId = useId();
  const yearBuiltErrorId = `${baseId}-year-built-error`;
  const unitsId = `${baseId}-units`;
  const addId = `${baseId}-add`;
  const undoId = `${baseId}-undo`;
  const importButtonId = `${baseId}-import`;
  const importPanelId = `${baseId}-import-panel`;
  const rowIdPrefix = (rowId: string) => `${baseId}-${rowId}`;
  const [editingYearBuilt, setEditingYearBuilt] = useState(false);
  const [picked, setPicked] = useState("");
  // What Load an example, Clear or an import replaced, offered back until the next edit.
  const [undo, setUndo] = useState<Undo | null>(initialUndo);
  const [announcement, setAnnouncement] = useState("");
  const [importing, setImporting] = useState(false);
  // Element to focus once the next render is on screen (after removing a row, say).
  const focusNext = useRef<string | null>(null);
  // The replace-now comparison's panel, ticks and Undo. Kept here because the
  // comparison goes away whenever nothing is at risk, and this lasts the page view.
  const [compare, setCompare] = useState<CompareState>(NEW_COMPARE_STATE);

  // The forecast and the notes under rows follow typing a moment later, so in a long
  // list each key press shows straight away and the forecast catches up after.
  const deferredDraft = useDeferredValue(draft);
  const { components, problems, unitCount, forecast } = useMemo(
    () => forecastDraft(deferredDraft, startYear),
    [deferredDraft, startYear],
  );
  // Condition and the guess flag for the lists under the forecast.
  const rowsById = useMemo(() => new Map(deferredDraft.rows.map((r) => [r.id, r])), [deferredDraft.rows]);
  const yearBuiltIsBad = badYearBuilt(draft.yearBuilt, startYear);
  const showYearBuiltError = yearBuiltIsBad && !editingYearBuilt;

  // Once per draft, as soon as it shows a forecast (the reserve can come from items after year 10).
  const trackedDraft = useRef<Draft | null>(null);
  const showsForecast = components.length > 0;
  useEffect(() => {
    if (!trackEvents || !showsForecast || draft.forecastTracked || trackedDraft.current === draft) return;
    trackedDraft.current = draft;
    setDraft((d) => ({ ...d, forecastTracked: true }));
    void track("forecast_generated", { components: String(components.length) });
  }, [trackEvents, showsForecast, draft, setDraft, components.length]);

  function markStarted(source: string) {
    if (tracked.current.started) return;
    tracked.current.started = true;
    void track("calculator_started", { source });
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  // Row edits and removals keep the same functions from render to render, so in a
  // long list (an import can add 2,000 rows) only the row that changed is redrawn.
  const latest = useRef({ draft, setDraft });
  useEffect(() => {
    latest.current = { draft, setDraft };
  });

  const updateRow = useCallback((id: string, patch: Partial<DraftRow>) => {
    latest.current.setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? editRow(r, patch, d.unitCount) : r)) }));
  }, []);

  const announce = useCallback((message: string) => {
    // A repeat of the same words wouldn't be read again, so vary it invisibly.
    setAnnouncement((current) => (current === message ? `${message}\u00a0` : message));
  }, []);

  const removeRow = useCallback(
    (id: string) => {
      const { rows } = latest.current.draft;
      const removed = rows.find((r) => r.id === id);
      const next = neighborRowId(rows, id);
      focusNext.current = next ? `${baseId}-${next}-name` : addId;
      latest.current.setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
      announce(`Removed ${removed?.name.trim() || "the component"}.`);
    },
    [baseId, addId, announce],
  );

  // Adding takes a pick and a press of Add, so arrowing through the list adds nothing.
  function addComponent() {
    if (!picked) return;
    const item = libraryBySlug.get(picked);
    const row = item ? rowFromLibrary(item, draft.unitCount) : customRow();
    setDraft((d) => ({ ...d, rows: [...d.rows, row] }));
    setPicked("");
    // A custom row needs a name first; otherwise stay on the list to add the next one.
    focusNext.current = item ? addId : `${rowIdPrefix(row.id)}-name`;
    announce(item ? `Added ${item.name}.` : "Added a custom component. Give it a name.");
    markStarted("add_component");
  }

  /**
   * Rows from a spreadsheet go after the ones already there. A component list
   * download also changes the rows its CapexClock IDs match, and can remove rows,
   * so that kind of import can be undone.
   */
  function applyImport(change: DraftImport, said: string) {
    const next = withImport(draft, change);
    const replaces = importReplaces(change);
    setUndo(replaces ? { before: draft, after: next, action: "import" } : null);
    setDraft(next);
    setImporting(false);
    const firstAdded = next.rows[next.rows.length - change.add.length];
    focusNext.current = change.add.length > 0 && firstAdded ? `${rowIdPrefix(firstAdded.id)}-name` : importButtonId;
    announce(replaces ? `${said} Undo brings back your list as it was.` : said);
    markStarted("import");
  }

  function closeImport() {
    setImporting(false);
    focusNext.current = importButtonId;
  }

  /** Load an example and Clear replace everything, so they offer an undo. */
  function replaceDraft(next: Draft, action: "clear" | "example") {
    setUndo(hasEntries(draft) ? { before: draft, after: next, action } : null);
    setDraft(next);
  }

  function loadExample() {
    replaceDraft(exampleDraft(), "example");
    announce(hasEntries(draft) ? "Loaded the example in place of your entries. Undo brings them back." : "Loaded the example.");
    markStarted("example");
  }

  function clearDraft() {
    replaceDraft(EMPTY_DRAFT, "clear");
    // Clear disappears with the rows, so move to Undo.
    focusNext.current = undoId;
    announce("Cleared your entries.");
  }

  function undoReplace() {
    if (!undo) return;
    setDraft(undo.before);
    setUndo(null);
    focusNext.current = unitsId;
    announce("Your entries are back.");
  }

  // Undo is offered until anything else changes the draft (tracking flags aside).
  const canUndo =
    undo !== null &&
    undo.after.rows === draft.rows &&
    undo.after.unitCount === draft.unitCount &&
    undo.after.yearBuilt === draft.yearBuilt;

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const incomplete = Object.keys(problems).length;

  // Screen readers hear the new totals once typing pauses, not on every keystroke.
  const summary = forecastSummary(components.length > 0 ? forecast : null, incomplete);
  const spokenSummary = useRef(summary);
  useEffect(() => {
    if (summary === spokenSummary.current) return;
    const timer = window.setTimeout(() => {
      spokenSummary.current = summary;
      setAnnouncement(summary);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [summary]);

  return (
    <div className="space-y-8">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {/* Property */}
      <section className={cardClass} aria-labelledby="property-heading">
        {header}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <h2 id="property-heading" className="sr-only">
              Your property
            </h2>
            <label className="block w-36">
              <span className={labelClass}>Rental units</span>
              <input
                id={unitsId}
                className={`${inputClass} mt-1`}
                inputMode="numeric"
                placeholder="e.g. 12"
                value={draft.unitCount}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft((d) => withUnitCount(d, value));
                }}
              />
            </label>
            <label className="block w-36">
              <span className={labelClass}>Year built</span>
              <input
                className={`${inputClass} mt-1`}
                inputMode="numeric"
                placeholder="e.g. 1998"
                value={draft.yearBuilt}
                aria-invalid={showYearBuiltError || undefined}
                aria-describedby={showYearBuiltError ? yearBuiltErrorId : undefined}
                onFocus={() => setEditingYearBuilt(true)}
                onBlur={() => setEditingYearBuilt(false)}
                onChange={(e) => updateDraft({ yearBuilt: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            {showExample && (
              <button
                type="button"
                onClick={loadExample}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
              >
                Load an example
              </button>
            )}
            {showExample && draft.rows.length > 0 && (
              <button
                type="button"
                onClick={clearDraft}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {canUndo && (
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            {undo.action === "clear"
              ? "Your entries were cleared."
              : undo.action === "import"
                ? "The import changed your list."
                : "The example replaced your entries."}{" "}
            <button
              id={undoId}
              type="button"
              onClick={undoReplace}
              className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
            >
              Undo
            </button>
          </p>
        )}
        {/* The error takes the hint's place in one grid cell, sized for the longer of the two, so
            showing it when the field is left never moves the button the owner is clicking. */}
        <div className="mt-3 grid text-sm">
          <p
            id={yearBuiltErrorId}
            className={`col-start-1 row-start-1 text-amber-800 dark:text-amber-300 ${showYearBuiltError ? "" : "invisible"}`}
          >
            {YEAR_BUILT_TEXT}
          </p>
          <p
            className={`col-start-1 row-start-1 text-slate-500 dark:text-slate-400 ${showYearBuiltError ? "invisible" : ""}`}
          >
            Year built fills in any install year you leave blank, marked as an estimate.
          </p>
        </div>
      </section>

      {/* Components */}
      <section className={cardClass} aria-labelledby="components-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="components-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
            Components
          </h2>
          <div className="flex items-center gap-2">
            <label htmlFor={addId} className="sr-only">
              Choose a component to add
            </label>
            <select
              id={addId}
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className={`${inputClass} w-56 font-medium sm:w-64`}
            >
              <option value="" disabled>
                Choose a component…
              </option>
              {Object.entries(libraryGroups).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name} ({item.lifeLow}–{item.lifeHigh} yrs)
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM}>Custom component…</option>
            </select>
            <button
              type="button"
              onClick={addComponent}
              disabled={!picked}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
        {/* Import and the component list on the left, the photo idea's test button on the right. */}
        <PaidIdeaDisclosure idea="photo">
          {(photoButton, photoPanel) => (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <button
                    id={importButtonId}
                    type="button"
                    aria-expanded={importing}
                    aria-controls={importing ? importPanelId : undefined}
                    onClick={() => (importing ? closeImport() : setImporting(true))}
                    className={textButton}
                  >
                    Import from a spreadsheet
                  </button>
                  {draft.rows.length > 0 &&
                    (["xlsx", "csv"] as const).map((format) => (
                      <ComponentListButton
                        key={format}
                        format={format}
                        name={exportName}
                        building={listName}
                        draft={draft}
                        where="components"
                        className={textButton}
                      />
                    ))}
                </div>
                {photoButton}
              </div>
              {importing && (
                <ImportPanel
                  id={importPanelId}
                  library={library}
                  draft={draft}
                  onApply={applyImport}
                  onClose={closeImport}
                  where={importWhere}
                  accountsEnabled={accountsEnabled}
                />
              )}
              {photoPanel && <div className="mt-3">{photoPanel}</div>}
            </>
          )}
        </PaidIdeaDisclosure>

        {draft.rows.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Add your roofs, HVAC, water heaters and other big-ticket items
            {showExample ? ", or load an example to see how it works." : "."}
          </p>
        ) : (
          <div className="mt-5">
            <div
              className={`hidden items-end gap-3 border-b border-slate-200 pb-2 lg:grid ${rowGridClass} dark:border-slate-800`}
              aria-hidden="true"
            >
              {["Component", "Quantity", "Installed", "Life (yrs)", "Cost", REPLACE_LABEL, ""].map((h) => (
                <span key={h} className={`${labelClass} ${h === REPLACE_LABEL ? "text-center" : ""}`}>
                  {h}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {draft.rows.map((row) => (
                <ListedRow
                  key={row.id}
                  row={row}
                  idPrefix={rowIdPrefix(row.id)}
                  yearBuilt={yearBuiltIsBad ? "" : draft.yearBuilt.trim()}
                  lib={row.librarySlug ? libraryBySlug.get(row.librarySlug) : undefined}
                  typical={row.librarySlug ? typicalBySlug.get(row.librarySlug) : undefined}
                  note={rowNotes?.[row.id]}
                  problem={problems[row.id]}
                  onRowChange={updateRow}
                  onRowRemove={removeRow}
                />
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Tick {REPLACE_LABEL} to plan a replacement in {startYear}, even if it isn&apos;t worn
              out yet. Its cycle starts again from there. If you already replaced something, change
              its install year instead.
            </p>
          </div>
        )}
      </section>

      {/* Results */}
      {components.length > 0 && (
        <section aria-labelledby="forecast-heading" className="space-y-6">
          <h2 id="forecast-heading" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Your {forecast.startYear}–{forecast.endYear} forecast
          </h2>

          {/* The reminders panel opens below the cards and what they mean, at full width. */}
          <PaidIdeaDisclosure idea="reminders" tone="dark">
            {(button, panel) => (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    label="Monthly reserve"
                    value={formatReserve(forecast.monthlyReserve)}
                    emphasis
                    action={button}
                  />
                  <Stat
                    label="Per unit, per month"
                    value={
                      forecast.monthlyReservePerUnit === null
                        ? "Add units"
                        : formatReserve(forecast.monthlyReservePerUnit)
                    }
                    emphasis
                  />
                  <Stat label={`Needed in ${forecast.startYear}`} value={formatMoney(forecast.neededNow)} />
                  <Stat label="10-year total" value={formatMoney(forecast.horizonTotal)} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The monthly reserve is the smallest steady amount that has the cash ready for every
                  replacement from {forecast.reserveFromYear} on, looking 30 years ahead.{" "}
                  {forecast.startYear} costs (overdue or due this year) are shown separately because
                  there&apos;s no time to save for them.
                </p>
                {incomplete > 0 && (
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {incomplete} component{incomplete === 1 ? " isn't" : "s aren't"} included yet. See the
                    notes above.
                  </p>
                )}
                {panel}
              </>
            )}
          </PaidIdeaDisclosure>

          <div className={cardClass}>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
              Replacement costs by year
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              In today&apos;s dollars, no inflation.
            </p>
            {forecast.horizonTotal > 0 ? (
              <>
                <ForecastChart forecast={forecast} />
                <ForecastTable forecast={forecast} />
              </>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Nothing comes due from {forecast.startYear} to {forecast.endYear}.
                {forecast.savingAhead.length > 0 &&
                  " The monthly reserve is saving ahead for the later replacements listed under What's due when."}
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <AtRisk forecast={forecast} rows={rowsById}>
              <CompareAtRisk
                startYear={startYear}
                unitCount={unitCount}
                components={components}
                rows={rowsById}
                draft={draft}
                setDraft={setDraft}
                state={compare}
                setState={setCompare}
                forecastPending={deferredDraft !== draft}
              />
            </AtRisk>
            <DueTable forecast={forecast} rows={rowsById} />
          </div>

          <ExportButtons
            name={exportName}
            unitCount={unitCount}
            forecast={forecast}
            components={components}
            rows={deferredDraft.rows}
            list={{ draft, building: listName }}
            onPayQuestionChange={onPayQuestionChange}
          />
        </section>
      )}
      {footer}
    </div>
  );
}

/**
 * A row in the list, redrawn only when its own props change. Its note is worked out
 * here from the row's problem, so a new note object each render doesn't redraw it.
 */
const ListedRow = memo(function ListedRow({
  row,
  note,
  problem,
  onRowChange,
  onRowRemove,
  ...props
}: {
  row: DraftRow;
  idPrefix: string;
  yearBuilt: string;
  lib: LibraryComponent | undefined;
  typical: TypicalCost | undefined;
  /** A note from the page, e.g. why the row can't be saved; it replaces the forecast's. */
  note: RowNote | undefined;
  problem: RowProblem | undefined;
  onRowChange: (id: string, patch: Partial<DraftRow>) => void;
  onRowRemove: (id: string) => void;
}) {
  return (
    <ComponentRow
      {...props}
      row={row}
      problem={note ?? (problem ? { text: problemText(row, problem), fields: problemFields(row, problem) } : null)}
      onChange={(patch) => onRowChange(row.id, patch)}
      onRemove={() => onRowRemove(row.id)}
    />
  );
});

function ComponentRow({
  row,
  idPrefix,
  yearBuilt,
  lib,
  typical,
  problem,
  onChange,
  onRemove,
}: {
  row: DraftRow;
  /** Starts the ids of this row's fields and note, e.g. `${idPrefix}-name`. */
  idPrefix: string;
  yearBuilt: string;
  lib: LibraryComponent | undefined;
  typical: TypicalCost | undefined;
  problem: RowNote | null;
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}) {
  const label = row.name.trim() || "this component";
  const problemId = `${idPrefix}-problem`;
  const hintId = `${idPrefix}-cost-hint`;
  const hint = costHint(row, lib, typical);
  const detailsId = `${idPrefix}-details`;
  const notesLeftId = `${idPrefix}-notes-left`;
  // Marks the field the row's note is about and points it at the note.
  const flag = (field: RowField) =>
    problem?.fields.includes(field) ? { "aria-invalid": true, "aria-describedby": problemId } : {};
  const costFlag = flag("costEach");
  const summary = detailsSummary(row);
  const notes = row.notes ?? "";
  const notesLeft = notesLeftText(notes);
  const notesOver = notesTooLong(notes);
  const notesFlagged = problem?.fields.includes("notes") === true;
  const notesDescribedBy =
    [notesFlagged ? problemId : "", notesLeft ? notesLeftId : ""].filter(Boolean).join(" ") || undefined;
  // Condition and notes sit behind More on narrow screens (see detailsShown).
  const notesNeedFixing = notesFlagged || notesOver;
  const [open, setOpen] = useState<boolean | null>(null);
  const [neededFixing, setNeededFixing] = useState(notesNeedFixing);
  if (notesNeedFixing !== neededFixing) {
    setNeededFixing(notesNeedFixing);
    if (notesNeedFixing) setOpen(null);
  }
  const showDetails = detailsShown(open, notesNeedFixing);

  return (
    <li className="py-4">
      {/* Rows out of view skip drawing, which keeps typing quick in a long list. The
          padding leaves room for focus outlines, since a skipped box clips what it holds. */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${rowGridClass} -m-1 p-1 ${offscreenClass} lg:items-start`}>
        <label className="col-span-2 block sm:col-span-3 lg:col-span-1">
          <span className={`${labelClass} lg:sr-only`}>Component</span>
          <input
            id={`${idPrefix}-name`}
            className={`${inputClass} mt-1 font-medium lg:mt-0`}
            value={row.name}
            maxLength={200}
            placeholder="e.g. Elevator"
            {...flag("name")}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{row.category}</span>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className={`${labelClass} lg:sr-only`}>Quantity</span>
          {/* On wide screens the unit goes under the number, like the notes under the other fields. */}
          <div className="mt-1 flex items-center gap-2 lg:mt-0 lg:flex-col lg:items-start lg:gap-0">
            <input
              className={inputClass}
              inputMode="decimal"
              value={row.quantity}
              placeholder={row.unitLabel === "per_sq_ft" ? "Sq ft" : undefined}
              aria-label={`Quantity of ${label}`}
              {...flag("quantity")}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
            <select
              value={row.unitLabel}
              aria-label={`How ${label} is counted`}
              onChange={(e) => onChange({ unitLabel: e.target.value as DraftRow["unitLabel"] })}
              className="shrink-0 cursor-pointer rounded-md border-0 bg-transparent py-1 text-xs text-slate-600 hover:text-slate-900 focus:ring-2 focus:ring-amber-500/30 lg:field-sizing-content dark:text-slate-400 dark:hover:text-white"
            >
              {Object.entries(UNIT_LABEL_TEXT).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
        </label>
        {/* Each name starts with the visible label, so "click Installed" works by voice. */}
        <div>
          <label className="block">
            <span className={`${labelClass} lg:sr-only`}>Installed</span>
            <input
              className={`${inputClass} mt-1 lg:mt-0`}
              inputMode="numeric"
              value={row.installYear}
              placeholder={yearBuilt ? `${yearBuilt} (est.)` : "Year"}
              aria-label={`Installed, ${label}`}
              {...flag("installYear")}
              onChange={(e) => onChange({ installYear: e.target.value })}
            />
          </label>
          {/* 24px tall with the padding, so it's an easy target right under the year. */}
          <label className="flex w-fit items-center gap-1.5 py-1 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={row.installYearIsGuess === true}
              aria-label={`Guess, install year of ${label}`}
              onChange={(e) => onChange({ installYearIsGuess: e.target.checked })}
              className="h-4 w-4 accent-amber-500"
            />
            Guess
          </label>
        </div>
        <label className="block">
          <span className={`${labelClass} lg:sr-only`}>Life (yrs)</span>
          <input
            className={`${inputClass} mt-1 lg:mt-0`}
            inputMode="numeric"
            value={row.usefulLife}
            aria-label={`Life (yrs), ${label}`}
            {...flag("usefulLife")}
            onChange={(e) => onChange({ usefulLife: e.target.value })}
          />
          {lib && (
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Typical {lib.lifeLow}–{lib.lifeHigh}
            </span>
          )}
        </label>
        <label className="block">
          <span className={`${labelClass} lg:sr-only`}>{costLabel(row)}</span>
          <div className="relative mt-1 lg:mt-0">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-500 dark:text-slate-400">
              $
            </span>
            <input
              className={`${inputClass} pl-6`}
              inputMode="decimal"
              value={row.costEach}
              placeholder="Quote or estimate"
              aria-label={`${costLabel(row)}, ${label}`}
              {...costFlag}
              aria-describedby={[costFlag["aria-describedby"], hint && hintId].filter(Boolean).join(" ") || undefined}
              onChange={(e) => onChange({ costEach: e.target.value })}
            />
          </div>
          <CostNote row={row} />
          {hint && (
            <span id={hintId} className="mt-0.5 block text-xs text-pretty text-slate-500 dark:text-slate-400">
              {hint}
            </span>
          )}
        </label>
        {/* As tall as a field and pushed down past a label's line, so the box sits on the fields' line. */}
        <label className="mt-7 flex min-h-[2.375rem] items-center gap-2 self-start text-sm text-slate-700 lg:mt-0 lg:justify-center dark:text-slate-300">
          <input
            type="checkbox"
            checked={row.scenario === "replace_now"}
            aria-label={`${REPLACE_LABEL}, ${label}`}
            onChange={(e) => onChange({ scenario: e.target.checked ? "replace_now" : "run_to_failure" })}
            className="h-4 w-4 accent-amber-500"
          />
          <span className="lg:sr-only">{REPLACE_LABEL}</span>
        </label>
        {/* More comes last, so the fields it shows are next in the tab order. */}
        <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:mt-7 sm:min-h-[2.375rem] sm:justify-end sm:self-start lg:mt-0">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setOpen(!showDetails)}
            aria-expanded={showDetails}
            aria-controls={detailsId}
            className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {showDetails ? "Less" : "More"}
            {!showDetails && summary && (
              <span className="font-normal text-slate-500 dark:text-slate-400"> ({summary})</span>
            )}
            {/* After the visible words, so the name starts with them and "click More" works by voice. */}
            <span className="sr-only">, condition and notes for {label}</span>
          </button>
        </div>
      </div>
      {/* Always shown on wide screens, as a second line under the row's columns. */}
      <div
        id={detailsId}
        className={`${showDetails ? "grid" : "hidden"} mt-3 grid-cols-1 gap-3 sm:grid-cols-3 lg:grid ${rowGridClass}`}
      >
        {/* Labels sit above, so these fields start at the same edges as the fields above them. */}
        <label className="block">
          <span className={labelClass}>Condition</span>
          <select
            value={row.condition ?? ""}
            aria-label={`Condition, ${label}`}
            onChange={(e) => onChange({ condition: CONDITIONS.find((c) => c === e.target.value) ?? null })}
            className={`${inputClass} mt-1`}
          >
            <option value="">Not set</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_TEXT[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2 lg:col-span-6">
          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea
              value={notes}
              maxLength={MAX_NOTES_LENGTH}
              rows={2}
              placeholder="e.g. Leaks a little. Quote from ABC Plumbing."
              aria-label={`Notes, ${label}`}
              aria-invalid={notesFlagged || notesOver ? true : undefined}
              aria-describedby={notesDescribedBy}
              // Opened for a problem, it stays open once that's fixed, rather than closing mid-edit.
              onFocus={() => setOpen(true)}
              onChange={(e) => onChange({ notes: e.target.value })}
              className={`${inputClass} mt-1 max-h-48 min-h-[4.5rem] field-sizing-content lg:min-h-[2.375rem]`}
            />
          </label>
          {notesLeft && (
            <p
              id={notesLeftId}
              className={`mt-1 text-xs lg:text-right ${
                notesOver ? "font-medium text-amber-800 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {notesLeft}
            </p>
          )}
        </div>
      </div>
      {problem && (
        <p id={problemId} className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          {problem.text}
        </p>
      )}
    </li>
  );
}

/** Shows the multiplication behind a row ("12 × $650 = $7,800"), or what the cost is for. */
function CostNote({ row }: { row: DraftRow }) {
  const total = rowTotal(row);
  if (total === null) {
    return (
      <span className="mt-1 hidden text-xs text-slate-500 lg:block dark:text-slate-400">
        {costLabel(row).replace(/^Cost /, "")}
      </span>
    );
  }
  const quantity = `${total.quantity.toLocaleString("en-US")}${row.unitLabel === "per_sq_ft" ? " sq ft" : ""}`;
  return (
    <span className="mt-1 block text-xs text-slate-500 tabular-nums dark:text-slate-400">
      {quantity} × {formatUnitPrice(total.each)} = {formatMoney(total.total)}
    </span>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
  action,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  /** A button under the number. */
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        emphasis
          ? "bg-slate-950 text-white dark:bg-slate-800"
          : "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <p className={`text-sm ${emphasis ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${emphasis ? "" : "text-slate-950 dark:text-white"}`}>
        {value}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** The chart's numbers as a table, for screen readers (the chart itself is hidden from them). */
function ForecastTable({ forecast }: { forecast: LandlordForecast }) {
  const { rows, present } = toChartRows(forecast);
  return (
    <div className="sr-only">
      <table>
        <caption>
          Replacement costs by year and category, {forecast.startYear} to {forecast.endYear}
        </caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Total</th>
            {present.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <th scope="row">{r.year}</th>
              <td>{formatMoney(r.total)}</td>
              {present.map((c) => (
                <td key={c}>{formatMoney(r[c] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rows by id, for the condition and guess flag the forecast doesn't carry. */
type RowsById = ReadonlyMap<string, DraftRow>;

/** After a name: the row's condition, then "(install year is a guess)" or "(install year estimated)". */
function NameNotes({ row, isEstimate }: { row: DraftRow | undefined; isEstimate: boolean }) {
  const yearNote = installYearNote(isEstimate, { installYearIsGuess: row !== undefined && guessedYear(row) });
  return (
    <>
      {row?.condition && (
        <>
          {" "}
          <span className="ml-0.5 text-xs text-slate-500 dark:text-slate-400">
            {CONDITION_TEXT[row.condition].toLowerCase()} condition
          </span>
        </>
      )}
      {yearNote && (
        <>
          {" "}
          <span className="ml-0.5 text-xs text-slate-500 dark:text-slate-400">({yearNote.toLowerCase()})</span>
        </>
      )}
    </>
  );
}

/** The at-risk card; children (the replace-now comparison) show under the list when it isn't empty. */
function AtRisk({ forecast, rows, children }: { forecast: LandlordForecast; rows: RowsById; children?: ReactNode }) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">At risk</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Past end of life or within 2 years of it.</p>
      <AtRiskList forecast={forecast} rows={rows} />
      {forecast.atRisk.length > 0 && children}
      {forecast.atRisk.length > 0 && <PaidIdeaButton idea="reminders" className="mt-5" />}
    </div>
  );
}

// The lists under the forecast can run to thousands of rows, so they're redrawn only
// when the forecast changes, not on every key press in the list of components. The
// comparison under this one isn't memoized, because Apply and Undo need the latest draft.
const AtRiskList = memo(function AtRiskList({ forecast, rows }: { forecast: LandlordForecast; rows: RowsById }) {
  return forecast.atRisk.length === 0 ? (
    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Nothing is close to end of life.</p>
  ) : (
    <ul className="mt-4 space-y-3">
      {forecast.atRisk.map((item) => (
        <li key={item.componentId} className="flex items-start justify-between gap-3 text-sm">
          <span className="text-slate-900 dark:text-white">
            {item.name}
            <NameNotes row={rows.get(item.componentId)} isEstimate={item.estimated.installYear} />
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              item.status === "overdue"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {riskText(item)}
          </span>
        </li>
      ))}
    </ul>
  );
});

const DueTable = memo(function DueTable({ forecast, rows: formRows }: { forecast: LandlordForecast; rows: RowsById }) {
  const rows = forecast.replacements;
  // Every row shows cents once any row has them, so the rows add up.
  const money = moneyColumn(rows.map((r) => r.cost));
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">What&apos;s due when</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          No replacements fall in the next 10 years.
        </p>
      ) : (
        <div className="mt-4 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={`${labelClass} py-2 pr-3`}>Year</th>
                <th className={`${labelClass} py-2 pr-3`}>Component</th>
                <th className={`${labelClass} py-2 text-right`}>Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={`${r.componentId}-${r.year}`}>
                  <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.year}</td>
                  <td className="py-2 pr-3 text-slate-900 dark:text-white">
                    {r.name}
                    {r.overdue && (
                      <>
                        {" "}
                        <span className="ml-0.5 text-xs text-red-700 dark:text-red-400">overdue</span>
                      </>
                    )}
                    <NameNotes row={formRows.get(r.componentId)} isEstimate={r.estimated.installYear} />
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-900 dark:text-white">
                    {money(r.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {forecast.savingAhead.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
            The monthly reserve is {rows.length > 0 && "also "}saving for
          </h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {forecast.savingAhead.map((r) => (
              <li key={`${r.componentId}-${r.year}`} className="flex justify-between gap-3">
                <span className="text-slate-900 dark:text-white">
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">{r.year}</span> {r.name}
                </span>
                <span className="tabular-nums text-slate-900 dark:text-white">{formatMoney(r.cost)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
