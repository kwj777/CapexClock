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
  badUnitCount,
  badYearBuilt,
  biggestDueCluster,
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
  isMissingProblem,
  MAX_NOTES_LENGTH,
  notesLeftText,
  notesTooLong,
  problemFields,
  problemText,
  rowFromLibrary,
  rowTotal,
  SAFETY_BUFFERS,
  safetyBufferOf,
  TYPICAL_COSTS,
  UNIT_COUNT_TEXT,
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
import { dueByYear, toChartRows } from "./chartData";
import { NEW_COMPARE_STATE, riskText, type CompareState } from "./compare";
import CompareAtRisk from "./CompareAtRisk";
import { costHint } from "./cost-hint";
import {
  clearArrival,
  clearImportUndo,
  loadDraft,
  peekArrival,
  peekImportUndo,
  saveDraft,
  type Arrival,
  STORAGE_KEY as DRAFT_STORAGE_KEY,
} from "./draft-storage";
import { dueClusterSentence, formatMoney, formatReserve, formatUnitPrice, safetyBufferSentence } from "./format";

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
  "block w-full rounded-md border border-slate-500 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-500 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
// A red border on a field marked invalid (the property's own fields).
const invalidClass = "aria-invalid:border-red-500 dark:aria-invalid:border-red-400";
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
  "py-1 text-left text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300";

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
    return {
      draft: loaded,
      undo: before ? { before, after: loaded, action: "import" as const } : null,
      // A lifespan page that just added a row says so here.
      arrival: peekArrival(loaded),
    };
  });
  const [draft, setDraft] = useState<Draft>(start.draft);
  // The Save box steps back while the pay question is asked, so the question isn't lost next to it.
  const [askingPay, setAskingPay] = useState(false);
  useEffect(() => saveDraft(draft), [draft]);
  // Offered once: a reload or a later visit doesn't offer it again.
  useEffect(() => {
    clearImportUndo();
    clearArrival();
  }, []);
  // Follow changes from other tabs, e.g. this work being saved to an account and cleared.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DRAFT_STORAGE_KEY || event.key === null) setDraft(loadDraft());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const name = (draft.name ?? "").trim();
  const saveId = useId();
  return (
    <CalculatorView
      draft={draft}
      setDraft={setDraft}
      library={library}
      typicalCosts={typicalCosts}
      trackEvents
      showExample
      nameField
      exportName={name || "My property"}
      listName={name}
      accountsEnabled={accountsEnabled}
      initialUndo={start.undo}
      arrival={start.arrival}
      lookUpOwnerEmail={accountsEnabled}
      onPayQuestionChange={setAskingPay}
      footer={
        accountsEnabled && draft.rows.length > 0 ? (
          <>
            <SaveToAccount id={saveId} quiet={askingPay} />
            <PhoneSaveBar saveBoxId={saveId} hidden={askingPay} />
          </>
        ) : null
      }
    />
  );
}

const SAVE_HREF = "/app/properties/new?from=calculator";

/** Quiet while another question on the page waits for an answer: still there, but not competing with it. */
function SaveToAccount({ id, quiet = false }: { id?: string; quiet?: boolean }) {
  return (
    <div
      id={id}
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
        href={SAVE_HREF}
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

/** True while focus is in a field that brings up a phone's keyboard. */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(el.type));
    const onFocusIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onFocusOut = (e: FocusEvent) => setTyping(isField(e.relatedTarget));
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return typing;
}

/**
 * On phones, a slim bar stuck to the bottom with the same Save link, since the Save
 * box is screens below the rows being edited. It steps aside while the keyboard is
 * up, while the pay question waits, and once the Save box itself is on screen or
 * scrolled past (so it never covers the footer).
 */
function PhoneSaveBar({ saveBoxId, hidden }: { saveBoxId: string; hidden: boolean }) {
  const typing = useTyping();
  const [boxReached, setBoxReached] = useState(false);
  useEffect(() => {
    const box = document.getElementById(saveBoxId);
    if (!box || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setBoxReached(entry.isIntersecting || entry.boundingClientRect.top < 0);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [saveBoxId]);
  if (hidden || typing || boxReached) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">Kept in this browser only.</p>
        <Link
          href={SAVE_HREF}
          className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Save to my account
        </Link>
      </div>
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
  /**
   * Shows the key numbers under the header with a link down to the forecast, which
   * can be far down a long property's page.
   */
  quickSummary?: boolean;
  /** Shows the draft's own optional Property name field (the public calculator). */
  nameField?: boolean;
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
  /** Why the unit count can't be saved, shown under the fields and marking Rental units invalid. */
  unitCountProblem?: string;
  /** An undo to offer from the start: an import on the template page that changed the list. */
  initialUndo?: Undo | null;
  /** The row a lifespan page just added, pointed to above the property card. */
  arrival?: Arrival | null;
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

/** A row just removed, offered back in its place until anything else changes the list. */
interface Removed {
  row: DraftRow;
  index: number;
  before: DraftRow[];
  after: DraftRow[];
}

/** A note shown under a row, and the row's fields it's about. */
export interface RowNote {
  text: string;
  fields: RowField[];
  /** Only something not filled in yet: shown as a next step, not an error, and the fields aren't marked invalid. */
  missing?: boolean;
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
  quickSummary = false,
  nameField = false,
  footer,
  exportName = "My property",
  listName = "",
  importWhere = "calculator",
  accountsEnabled = false,
  library = COMPONENT_LIBRARY,
  typicalCosts = TYPICAL_COSTS,
  rowNotes,
  unitCountProblem,
  initialUndo = null,
  arrival = null,
  onPayQuestionChange,
}: Omit<CalculatorViewProps, "where" | "ownerEmail" | "lookUpOwnerEmail">) {
  const libraryBySlug = useMemo(() => new Map(library.map((c) => [c.slug, c])), [library]);
  const typicalBySlug = useMemo(() => new Map(typicalCosts.map((c) => [c.slug, c])), [typicalCosts]);
  const libraryGroups = useMemo(() => groupByCategory(library), [library]);
  const [startYear] = useState(() => new Date().getFullYear());
  const tracked = useRef({ started: !trackEvents || draft.rows.length > 0 });
  const baseId = useId();
  const yearBuiltErrorId = `${baseId}-year-built-error`;
  const unitsErrorId = `${baseId}-units-error`;
  const unitsSaveErrorId = `${baseId}-units-save-error`;
  const unitsId = `${baseId}-units`;
  const undoRemoveId = `${baseId}-undo-remove`;
  const addId = `${baseId}-add`;
  const undoId = `${baseId}-undo`;
  const importButtonId = `${baseId}-import`;
  const importPanelId = `${baseId}-import-panel`;
  const rowIdPrefix = (rowId: string) => `${baseId}-${rowId}`;
  const [editingYearBuilt, setEditingYearBuilt] = useState(false);
  const [editingUnits, setEditingUnits] = useState(false);
  const [picked, setPicked] = useState("");
  // What Load an example, Clear or an import replaced, offered back until the next edit.
  const [undo, setUndo] = useState<Undo | null>(initialUndo);
  const [removed, setRemoved] = useState<Removed | null>(null);
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
  const showUnitsError = badUnitCount(draft.unitCount) && !editingUnits;
  const showUnitsSaveProblem = Boolean(unitCountProblem) && !showUnitsError;

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

  // Removing leaves "Removed X. Undo" in the row's place, and focus on that Undo.
  const removeRow = useCallback(
    (id: string) => {
      const { rows } = latest.current.draft;
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) return;
      const after = rows.filter((r) => r.id !== id);
      setRemoved({ row: rows[index], index, before: rows, after });
      focusNext.current = undoRemoveId;
      latest.current.setDraft((d) => ({ ...d, rows: d.rows === rows ? after : d.rows.filter((r) => r.id !== id) }));
      announce(`Removed ${rows[index].name.trim() || "the component"}. Undo brings it back.`);
    },
    [undoRemoveId, announce],
  );

  // Offered until anything else changes the list.
  const canUndoRemove = removed !== null && removed.after === draft.rows;

  function undoRemove() {
    if (!removed || !canUndoRemove) return;
    setDraft((d) => ({ ...d, rows: removed.before }));
    setRemoved(null);
    focusNext.current = `${rowIdPrefix(removed.row.id)}-name`;
    announce(`${removed.row.name.trim() || "The component"} is back.`);
  }

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

  // Said once on arrival from a lifespan page, a moment after the page is up so screen
  // readers have the live region; the note above the property card stays.
  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => announce(`Added ${arrival.name} to your list below.`), 500);
    return () => window.clearTimeout(timer);
  }, [arrival, announce]);
  const arrivedRow = arrival && draft.rows.some((r) => r.id === arrival.rowId) ? arrival : null;

  function showArrivedRow(rowId: string) {
    const field = document.getElementById(`${rowIdPrefix(rowId)}-name`);
    field?.scrollIntoView({ block: "center" });
    field?.focus({ preventScroll: true });
  }

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

  const rowItems = draft.rows.map((row) => (
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
  ));
  // "Removed X. Undo" stands in the removed row's place, where the owner is looking.
  if (canUndoRemove) {
    rowItems.splice(
      removed.index,
      0,
      <li key={`removed-${removed.row.id}`} className="flex flex-wrap items-center gap-x-2 py-4 text-sm text-slate-700 dark:text-slate-300">
        Removed {removed.row.name.trim() || "a component"}.
        <button
          id={undoRemoveId}
          type="button"
          onClick={undoRemove}
          className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
        >
          Undo
        </button>
      </li>,
    );
  }

  return (
    <div className="space-y-8">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {arrivedRow && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-slate-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-slate-100 dark:ring-amber-500/30">
          Added {arrivedRow.name} to your list.{" "}
          <button type="button" onClick={() => showArrivedRow(arrivedRow.rowId)} className={textButton}>
            See it below<span aria-hidden="true"> ↓</span>
          </button>
        </p>
      )}
      {/* Property */}
      <section className={cardClass} aria-labelledby="property-heading">
        {header}
        {quickSummary && components.length > 0 && (
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">
              Monthly reserve{" "}
              <span className="font-semibold tabular-nums text-slate-950 dark:text-white">
                {formatReserve(forecast.monthlyReserve)}
              </span>
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              Needed in {forecast.startYear}{" "}
              <span className="font-semibold tabular-nums text-slate-950 dark:text-white">
                {formatMoney(forecast.neededNow)}
              </span>
            </span>{" "}
            ·{" "}
            <a
              href="#forecast-heading"
              className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <span className="whitespace-nowrap">
                See forecast<span aria-hidden="true"> ↓</span>
              </span>
            </a>
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <h2 id="property-heading" className="sr-only">
              Your property
            </h2>
            {nameField && (
              <label className="block w-full sm:w-64">
                <span className={labelClass}>
                  Property name <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
                </span>
                <input
                  className={`${inputClass} mt-1`}
                  maxLength={200}
                  placeholder="e.g. 14 Maple Court"
                  value={draft.name ?? ""}
                  onChange={(e) => updateDraft({ name: e.target.value })}
                />
              </label>
            )}
            <label className="block w-36">
              <span className={labelClass}>Rental units</span>
              <input
                id={unitsId}
                className={`${inputClass} ${invalidClass} mt-1`}
                inputMode="numeric"
                placeholder="e.g. 12"
                value={draft.unitCount}
                aria-invalid={showUnitsError || showUnitsSaveProblem || undefined}
                aria-describedby={
                  showUnitsError ? unitsErrorId : showUnitsSaveProblem ? unitsSaveErrorId : undefined
                }
                onFocus={() => setEditingUnits(true)}
                onBlur={() => setEditingUnits(false)}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft((d) => withUnitCount(d, value));
                }}
              />
            </label>
            <label className="block w-36">
              <span className={labelClass}>Year built</span>
              <input
                className={`${inputClass} ${invalidClass} mt-1`}
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
            <label className="block w-36">
              <span className={labelClass}>Safety buffer</span>
              <select
                className={`${inputClass} mt-1`}
                value={safetyBufferOf(draft.safetyBuffer)}
                onChange={(e) => updateDraft({ safetyBuffer: safetyBufferOf(Number(e.target.value)) })}
              >
                {SAFETY_BUFFERS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? "None" : `+${b}%`}
                  </option>
                ))}
              </select>
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
        {/* Why a saved property's unit count can't be saved (e.g. over 100,000), when the
            field's own message below doesn't already cover it. */}
        {showUnitsSaveProblem && (
          <p id={unitsSaveErrorId} className="mt-3 text-sm text-amber-800 dark:text-amber-300">
            {unitCountProblem}
          </p>
        )}
        {/* The errors take the hint's place in one grid cell, sized for the longest, so
            showing them when a field is left never moves the button the owner is clicking. */}
        <div className="mt-3 grid text-sm">
          <p
            className={`col-start-1 row-start-1 text-amber-800 dark:text-amber-300 ${
              showYearBuiltError || showUnitsError ? "" : "invisible"
            }`}
          >
            <span id={unitsErrorId} className={showUnitsError ? "" : "hidden"}>
              {UNIT_COUNT_TEXT}
            </span>
            {showUnitsError && showYearBuiltError && " "}
            <span id={yearBuiltErrorId}>{showYearBuiltError || !showUnitsError ? YEAR_BUILT_TEXT : ""}</span>
          </p>
          <p
            className={`col-start-1 row-start-1 text-slate-500 dark:text-slate-400 ${
              showYearBuiltError || showUnitsError ? "invisible" : ""
            }`}
          >
            Year built fills in any install year you leave blank, marked as an estimate. A safety
            buffer adds 10% or 20% to the monthly reserve, for repairs that come early.
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
        {/* The forecast is below the whole list, screens down on a phone, so the answer is
            pointed to from where components are added. */}
        {components.length > 0 && (
          <p className="mt-3 text-sm text-slate-700 sm:text-right dark:text-slate-300">
            Monthly reserve{" "}
            <span className="font-semibold tabular-nums text-slate-950 dark:text-white">
              {formatReserve(forecast.monthlyReserve)}
            </span>
            {forecast.monthlyReservePerUnit !== null && (
              <span className="tabular-nums"> ({formatReserve(forecast.monthlyReservePerUnit)}/unit)</span>
            )}{" "}
            ·{" "}
            <a href="#forecast-heading" className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">
              See your forecast <span aria-hidden="true">↓</span>
            </a>
          </p>
        )}
        {/* Import and the component list on the left, the photo idea's test button on the right. */}
        <PaidIdeaDisclosure idea="photo">
          {(photoButton, photoPanel) => (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-x-5 gap-y-3">
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

        {draft.rows.length === 0 && !canUndoRemove ? (
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
              {rowItems}
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
                    value={forecast.monthlyReservePerUnit === null ? "—" : formatReserve(forecast.monthlyReservePerUnit)}
                    emphasis
                    action={
                      forecast.monthlyReservePerUnit === null && (
                        <button
                          type="button"
                          onClick={() => {
                            const units = document.getElementById(unitsId);
                            units?.scrollIntoView({ behavior: "smooth", block: "center" });
                            units?.focus({ preventScroll: true });
                          }}
                          className="rounded-md px-2.5 py-1 text-sm font-medium text-white ring-1 ring-white/40 hover:bg-white/10"
                        >
                          Enter rental units <span aria-hidden="true">↑</span>
                        </button>
                      )
                    }
                  />
                  <Stat label={`Needed in ${forecast.startYear}`} value={formatMoney(forecast.neededNow)} />
                  <Stat label="10-year total" value={formatMoney(forecast.horizonTotal)} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The monthly reserve is the smallest steady amount that has the cash ready for every
                  replacement from {forecast.reserveFromYear} on, looking 30 years ahead.{" "}
                  {safetyBufferSentence(forecast) && `${safetyBufferSentence(forecast)} `}
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
            <DueClusterNote forecast={forecast} />
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

          {/* Cards keep their own height on desktop, so a long list doesn't stretch the other. */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
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
            yearBuilt={deferredDraft.yearBuilt}
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
      problem={
        note ??
        (problem
          ? { text: problemText(row, problem), fields: problemFields(row, problem), missing: isMissingProblem(problem) }
          : null)
      }
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
  const lifeHintId = `${idPrefix}-life-hint`;
  const costMathId = `${idPrefix}-cost-math`;
  const hint = costHint(row, lib, typical);
  const detailsId = `${idPrefix}-details`;
  const conditionHelpId = `${idPrefix}-condition-help`;
  const notesLeftId = `${idPrefix}-notes-left`;
  // Marks the field the row's note is about and points it at the note. Something
  // not filled in yet is only pointed at the note, not marked invalid.
  const flag = (field: RowField) =>
    problem?.fields.includes(field)
      ? { "aria-invalid": problem.missing ? undefined : true, "aria-describedby": problemId }
      : {};
  const costFlag = flag("costEach");
  const lifeFlag = flag("usefulLife");
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
            {...lifeFlag}
            aria-describedby={[lifeFlag["aria-describedby"], lib && lifeHintId].filter(Boolean).join(" ") || undefined}
            onChange={(e) => onChange({ usefulLife: e.target.value })}
          />
          {lib && (
            <span id={lifeHintId} className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Typical {lib.lifeLow}–{lib.lifeHigh}
            </span>
          )}
        </label>
        {/* Full width on phones, so the 16px placeholder isn't cut off. */}
        <label className="col-span-2 block sm:col-span-1">
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
              // After any error: the row's maths ("12 × $650 = $7,800"), then the typical cost.
              aria-describedby={
                [costFlag["aria-describedby"], rowTotal(row) && costMathId, hint && hintId].filter(Boolean).join(" ") ||
                undefined
              }
              onChange={(e) => onChange({ costEach: e.target.value })}
            />
          </div>
          <CostNote row={row} id={costMathId} />
          {hint && (
            <span
              id={hintId}
              className={`mt-0.5 block text-xs text-pretty ${
                hint.warn ? "font-medium text-amber-800 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {hint.text}
            </span>
          )}
        </label>
        {/* As tall as a field and pushed down past a label's line, so the box sits on the fields' line.
            Phones put it beside Remove and More instead. */}
        <label className="flex min-h-[2.375rem] items-center gap-2 self-start text-sm text-slate-700 sm:mt-7 lg:mt-0 lg:justify-center dark:text-slate-300">
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
        <div className="flex items-center justify-between gap-2 sm:mt-7 sm:min-h-[2.375rem] sm:justify-end sm:self-start lg:mt-0">
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
        <div>
        <label className="block">
          <span className={labelClass}>Condition</span>
          <select
            value={row.condition ?? ""}
            aria-label={`Condition, ${label}`}
            aria-describedby={conditionHelpId}
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
          <p id={conditionHelpId} className="mt-1 text-xs text-pretty text-slate-500 dark:text-slate-400">
            For your notes and the report. It doesn&apos;t change the dates. To plan it now, tick {REPLACE_LABEL}.
          </p>
        </div>
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
        <p
          id={problemId}
          className={`mt-2 text-sm ${problem.missing ? "text-slate-500 dark:text-slate-400" : "text-amber-800 dark:text-amber-300"}`}
        >
          {problem.text}
        </p>
      )}
    </li>
  );
}

/** Shows the multiplication behind a row ("12 × $650 = $7,800"), or what the cost is for. */
function CostNote({ row, id }: { row: DraftRow; id: string }) {
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
    <span id={id} className="mt-1 block text-xs text-slate-500 tabular-nums dark:text-slate-400">
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
      className={`min-w-0 rounded-2xl p-5 ${
        emphasis
          ? "bg-slate-950 text-white dark:bg-slate-800 dark:ring-1 dark:ring-slate-500"
          : "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <p className={`text-sm ${emphasis ? "text-slate-300 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>
        {label}
      </p>
      {/* A huge (typo-sized) total wraps instead of running out of the card. */}
      <p
        className={`mt-1 text-3xl font-semibold tabular-nums wrap-anywhere ${emphasis ? "" : "text-slate-950 dark:text-white"}`}
      >
        {value}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Names the costliest year when several things come due at once, so the monthly reserve makes sense. */
function DueClusterNote({ forecast }: { forecast: LandlordForecast }) {
  const cluster = biggestDueCluster(forecast);
  if (!cluster) return null;
  return (
    <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <span className="font-semibold">Big year ahead: </span>
      {dueClusterSentence(cluster)} The monthly reserve saves for it ahead of time.
    </p>
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
      {forecast.atRisk.length > 0 && <PaidIdeaButton idea="reminders" where="for items at risk" className="mt-5" />}
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
    // On desktop it scrolls past the height of What's due when, beside it.
    <ul
      tabIndex={0}
      aria-label="Components at risk"
      className={`mt-4 space-y-3 lg:max-h-96 lg:overflow-y-auto lg:pr-2 ${scrollBoxFocus}`}
    >
      {forecast.atRisk.map((item) => {
        const row = rows.get(item.componentId);
        // Already set to Replace this year, so it's planned for, not a warning.
        const replacing = row?.scenario === "replace_now";
        return (
          <li key={item.componentId} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-900 dark:text-white">
              {item.name}
              <NameNotes row={row} isEstimate={item.estimated.installYear} />
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                replacing
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : item.status === "overdue"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {replacing ? `Replacing ${forecast.startYear}` : riskText(item)}
            </span>
          </li>
        );
      })}
    </ul>
  );
});

/** A scroll box's focus ring, for the keyboard only. */
const scrollBoxFocus =
  "rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900";

const DueTable = memo(function DueTable({ forecast, rows: formRows }: { forecast: LandlordForecast; rows: RowsById }) {
  const rows = forecast.replacements;
  // Every row shows cents once any row has them, so the rows add up.
  const money = moneyColumn(rows.map((r) => r.cost));
  const byYear = dueByYear(rows);
  const headingId = useId();
  return (
    <div className={cardClass}>
      <h3 id={headingId} className="text-base font-semibold text-slate-950 dark:text-white">
        What&apos;s due when
      </h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          No replacements fall in the next 10 years.
        </p>
      ) : (
        // Focusable, so it scrolls from the keyboard in every browser.
        <div
          role="region"
          tabIndex={0}
          aria-labelledby={headingId}
          className={`mt-4 max-h-96 overflow-y-auto ${scrollBoxFocus}`}
        >
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className={`${labelClass} py-2 pr-3`}>Component</th>
                <th className={`${labelClass} py-2 text-right`}>Cost</th>
              </tr>
            </thead>
            {/* One group per year, headed by its total, so nobody adds up rows. The year stays in view while its rows scroll. */}
            {byYear.map(({ year, total, items }) => (
              <tbody key={year} className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  {/* -top-0.5: at top-0, rows scrolling under the year show through a gap above it in Chromium. */}
                  <th
                    scope="rowgroup"
                    colSpan={2}
                    className="sticky -top-0.5 z-10 bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {year} · {money(total)}
                  </th>
                </tr>
                {items.map((r) => (
                  <tr key={`${r.componentId}-${r.year}`}>
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
            ))}
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
