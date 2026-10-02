"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type SetStateAction } from "react";
import SheetReview, { type SheetState } from "@/components/import/SheetReview";
import SourcePicker, {
  headingClass,
  inputClass,
  labelClass,
  secondaryButton,
  type SourceRead,
} from "@/components/import/SourcePicker";
import TemplateLink from "@/components/import/TemplateLink";
import { track } from "@/lib/analytics";
import {
  CREATE_FAILURE_TEXT,
  createInTurn,
  createLabel,
  createSummary,
  MAX_PROPERTIES,
  NO_NAME_TEXT,
  NO_UNITS_TEXT,
  planProperty,
  plannedProblems,
  plannedSave,
  propertyFieldProblems,
  withEdits,
  type CreateResult,
  type PlannedProperty,
  type PropertyEdits,
} from "@/lib/import/buildings";
import { createMatcher } from "@/lib/import/names";
import { startingChoices, type OpenedSheet } from "@/lib/import/open";
import { buildPreview, type Preview } from "@/lib/import/preview";
import { failedReason, PROBLEM_TEXT, type Problem } from "@/lib/import/read";
import { openTabs, startingTabs, tabNote, tabRowCounts, type OpenedTab } from "@/lib/import/tabs";
import { previewSummary } from "@/lib/import/wording";
import type { LibraryComponent } from "@/lib/library/components";
import type { SaveInput } from "@/lib/properties/convert";
import { compareSaved, DETAILS_NOT_SAVED_TEXT, saveFailure, sendsDetails } from "@/lib/properties/save";
import { createClient } from "@/lib/supabase/client";
import { isSignedOut, readBack } from "./read-back";

const NO_DUPLICATES = new Set<string>();
// Fields of a property that's created (or left out) can't be changed here any more.
const lockedClass = "read-only:bg-slate-100 read-only:text-slate-600 dark:read-only:bg-slate-800 dark:read-only:text-slate-300";

interface TabPlan {
  tab: number;
  /** Every row of the tab, for checking its columns. */
  preview: Preview;
  properties: PlannedProperty[];
}

export interface PortfolioImportProps {
  library: LibraryComponent[];
  /** The account's properties when the panel opened, so a retry can tell a property this import made. */
  propertyIds: readonly string[];
  onClose: () => void;
  id: string;
}

/**
 * Makes a property for each building in a spreadsheet: one per ticked tab, or one
 * per name in a Building column, up to 20 at once. The owner checks each one's
 * name, units and year built, then they're saved one at a time with
 * save_property. Ones that fail can be sent again on their own. The sheet is read
 * in this browser; only the properties are saved.
 */
export default function PortfolioImport({ library, propertyIds, onClose, id }: PortfolioImportProps) {
  const router = useRouter();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const resultId = `${baseId}-result`;
  const [currentYear] = useState(() => new Date().getFullYear());
  const match = useMemo(() => createMatcher(library), [library]);
  const [read, setRead] = useState<SourceRead | null>(null);
  const [tabs, setTabs] = useState<OpenedTab[]>([]);
  const [ticked, setTicked] = useState<number[]>([]);
  const [sheets, setSheets] = useState<Record<number, SheetState>>({});
  const [reviewTab, setReviewTab] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [edits, setEdits] = useState<Record<string, PropertyEdits>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, CreateResult>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [showProblems, setShowProblems] = useState(false);
  const known = useRef(new Set(propertyIds));
  const previewed = useRef<SourceRead | null>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [runs, setRuns] = useState(0);

  const started = Object.keys(results).length > 0;
  const tabRows = useMemo(() => tabRowCounts(tabs, library, match, currentYear), [tabs, library, match, currentYear]);

  const plans = useMemo((): TabPlan[] => {
    if (!read) return [];
    // A CSV or pasted sheet's "tab" is the file, so properties are named after the file instead.
    const names = (t: number) => ({ tab: read.source === "xlsx" ? (read.tabs[t]?.name ?? null) : null, file: read.fileName });
    return ticked.flatMap((t): TabPlan[] => {
      const opened = tabs[t];
      const state = sheets[t];
      if (typeof opened !== "object" || !state) return [];
      const all = buildPreview(opened.sheet, { ...state.choices, building: null }, library, match, currentYear);
      const { buildings } = all;
      const properties =
        buildings.length <= 1
          ? buildings.map((b) => planProperty(t, b, all.rows.map((r) => r.row), names(t)))
          : buildings.map((b) => {
              const one = buildPreview(opened.sheet, { ...state.choices, building: b.key }, library, match, currentYear);
              return planProperty(t, b, one.rows.map((r) => r.row), names(t));
            });
      return [{ tab: t, preview: all, properties }];
    });
  }, [read, ticked, tabs, sheets, library, match, currentYear]);

  const planned = useMemo(() => plans.flatMap((p) => p.properties.map((property) => withEdits(property, edits[property.id]))), [plans, edits]);
  const isIncluded = (p: PlannedProperty, index: number) => included[p.id] ?? index < MAX_PROPERTIES;
  const chosen = planned.filter((p, i) => isIncluded(p, i));
  const problems = useMemo(() => new Map(planned.map((p) => [p.id, plannedProblems(p, currentYear)])), [planned, currentYear]);
  const toCreate = chosen.filter((p) => results[p.id]?.status !== "created");
  const failed = chosen.filter((p) => results[p.id]?.status === "failed");
  const sheetYearBad = plans.some((p) => p.preview.usesSheetYear && sheets[p.tab]?.choices.sheetYear === null);
  const blocked = toCreate.some((p) => (problems.get(p.id) ?? []).length > 0) || sheetYearBad;
  const fromDownload = plans.some((p) => p.preview.idColumn);
  const review = plans.find((p) => p.tab === reviewTab) ?? plans[0];

  useEffect(() => {
    if (runs > 0) resultRef.current?.focus();
  }, [runs]);

  // Counts only: never names or anything from the sheet.
  useEffect(() => {
    if (!read || previewed.current === read || plans.length === 0) return;
    previewed.current = read;
    const rows = plans.reduce((n, p) => n + p.preview.counts.rows, 0);
    const ready = plans.reduce((n, p) => n + p.preview.counts.ready, 0);
    const flagged = plans.reduce((n, p) => n + p.preview.counts.changed + p.preview.counts.needsYou, 0);
    const skipped = plans.reduce((n, p) => n + p.preview.counts.skipped, 0);
    const properties = plans.reduce((n, p) => n + p.properties.length, 0);
    void track("import_previewed", { rows, ready, flagged, skipped, source: read.source, properties, where: "portfolio" });
  }, [read, plans]);

  function onRead(next: SourceRead) {
    const list = openTabs(next.tabs, match, currentYear);
    const usable = list.flatMap((t, i) => (typeof t === "object" ? [i] : []));
    if (usable.length === 0) {
      const only = list[0];
      const reason = typeof only === "string" && list.length === 1 ? only : "no_header";
      setRead(null);
      setProblem(reason);
      const sent = failedReason(reason);
      if (sent) void track("import_failed", { reason: sent, source: next.source, where: "portfolio" });
      return;
    }
    const starting = startingTabs(next.tabs, list);
    const states: Record<number, SheetState> = {};
    for (const i of usable) {
      const tab = list[i];
      if (typeof tab === "object") states[i] = { choices: startingChoices(tab, currentYear), sheetYearText: String(currentYear) };
    }
    setRead(next);
    setTabs(list);
    setTicked(starting);
    setSheets(states);
    setReviewTab(starting[0] ?? usable[0]);
    setReviewOpen(false);
    setEdits({});
    setIncluded({});
    setProblem(null);
    setShowProblems(false);
  }

  function onProblem(next: Problem) {
    setRead(null);
    setProblem(next);
  }

  function setSheet(t: number) {
    return (update: SetStateAction<SheetState>) =>
      setSheets((s) => {
        const current = s[t];
        if (!current) return s;
        return { ...s, [t]: typeof update === "function" ? update(current) : update };
      });
  }

  function tick(t: number, on: boolean) {
    setTicked((list) => (on ? [...list, t].sort((a, b) => a - b) : list.filter((x) => x !== t)));
  }

  function edit(property: PlannedProperty, field: keyof PropertyEdits, value: string) {
    setEdits((e) => ({ ...e, [property.id]: { ...e[property.id], [field]: value } }));
  }

  /**
   * A retry after an answer that never came back: the property may have been made
   * then. One with the same name, made since the panel opened and holding exactly
   * what this sends, is taken as this one instead of making it twice.
   */
  async function alreadyCreated(input: SaveInput, claimed: ReadonlySet<string>): Promise<CreateResult | null> {
    const { data, error } = await createClient().from("properties").select("id").eq("name", input.property.name);
    if (error || !data) return null;
    for (const { id: propertyId } of data) {
      if (known.current.has(propertyId) || claimed.has(propertyId)) continue;
      const back = await readBack(propertyId);
      if (!back?.property) continue;
      const match = compareSaved(input, back.property, back.components);
      if (match !== "different") {
        return { status: "created", propertyId, components: input.components.length, detailsDropped: match === "without_details" };
      }
    }
    return null;
  }

  async function createOne(property: PlannedProperty, claimed: ReadonlySet<string>): Promise<CreateResult> {
    const input = plannedSave(property, currentYear);
    const before = results[property.id];
    if (before?.status === "failed" && before.failure === "network") {
      const found = await alreadyCreated(input, claimed);
      if (found) return found;
    }
    const supabase = createClient();
    const { data: newId, error, status } = await supabase.rpc("save_property", {
      p_property: input.property,
      p_components: input.components,
    });
    if (error || !newId) {
      let failure = saveFailure(error, status);
      if (failure === "network" && (await isSignedOut())) failure = "signed_out";
      return { status: "failed", failure };
    }
    void track("property_saved", { components: String(input.components.length), source: "import" });
    // A database without update 0004 drops condition and notes without an error.
    let detailsDropped = false;
    if (sendsDetails(input)) {
      const back = await readBack(newId);
      detailsDropped = !!back?.property && compareSaved(input, back.property, back.components) === "without_details";
    }
    return { status: "created", propertyId: newId, components: input.components.length, detailsDropped };
  }

  async function create(retry: boolean) {
    if (running) return;
    const send = retry ? failed : toCreate;
    if (send.length === 0) return;
    if (blocked) {
      setShowProblems(true);
      return;
    }
    setRunning(true);
    const byId = new Map(send.map((p) => [p.id, p]));
    const claimed = new Set(Object.values(results).flatMap((r) => (r.status === "created" ? [r.propertyId] : [])));
    const run: CreateResult[] = [];
    let done = 0;
    setProgress(`Creating ${done + 1} of ${send.length}…`);
    await createInTurn(
      send.map((p) => p.id),
      async (pid) => {
        const property = byId.get(pid);
        return property ? createOne(property, claimed) : { status: "failed", failure: "network" };
      },
      (pid, result) => {
        run.push(result);
        if (result.status === "created") claimed.add(result.propertyId);
        done += 1;
        setResults((r) => ({ ...r, [pid]: result }));
        if (done < send.length) setProgress(`Creating ${done + 1} of ${send.length}…`);
      },
    );
    const created = run.filter((r) => r.status === "created");
    // A retry finishes the same import again, so it has its own event and the
    // import finish rate (import_completed ÷ import_started) counts each import once.
    void track(retry ? "import_retried" : "import_completed", {
      rows_added: created.reduce((n, r) => n + (r.status === "created" ? r.components : 0), 0),
      properties_created: created.length,
      properties_failed: run.length - created.length,
      source: read?.source ?? "file",
      where: "portfolio",
    });
    setProgress("");
    setRunning(false);
    // The button clicked is gone or disabled, so focus goes to what happened, once it's shown.
    setRuns((n) => n + 1);
    if (created.length > 0) router.refresh();
  }

  const allResults = chosen.flatMap((p) => (results[p.id] ? [results[p.id]] : []));
  const summary = createSummary(allResults);
  const usable = tabs.filter((t) => typeof t === "object").length;
  const anyHidden = read?.tabs.some((t) => t.hidden) ?? false;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="ph-no-capture mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-950/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold text-slate-950 dark:text-white">
          Import properties from a spreadsheet
        </h2>
        <button type="button" onClick={onClose} disabled={running} className={secondaryButton}>
          Close
        </button>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Make a property for each building in your sheet, up to {MAX_PROPERTIES} at once. Give each building its own tab,
        or name it in a Building column. Your sheet is read in this browser and never uploaded.
      </p>
      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        Starting from scratch? <TemplateLink file="template" where="import_portfolio" />. To add rows to a property you
        already have, open it and use Import from a spreadsheet there.
      </p>

      {!started && <SourcePicker onRead={onRead} onProblem={onProblem} />}

      {problem && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {PROBLEM_TEXT[problem]}
        </p>
      )}

      {read && (
        <div className="mt-6 space-y-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <fieldset disabled={started || running} className="space-y-6">
            {read.tabs.length > 1 && (
              <div>
                <p className={headingClass} id={`${baseId}-tabs`}>
                  Which tabs?
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Each ticked tab becomes a property, or one for each building when it has a Building column.
                  {anyHidden ? " Tabs hidden in your spreadsheet are marked hidden and start unticked." : ""}
                </p>
                <div role="group" aria-labelledby={`${baseId}-tabs`} className="mt-2 flex flex-col gap-1.5">
                  {read.tabs.map((tab, i) => (
                    <label key={i} className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={ticked.includes(i)}
                        disabled={typeof tabs[i] !== "object"}
                        onChange={(e) => tick(i, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                      />
                      <span className="wrap-anywhere">
                        {tab.name}{" "}
                        <span className="text-slate-500 dark:text-slate-400">({tabNote(tab, tabs[i], tabRows[i] ?? null)})</span>
                      </span>
                    </label>
                  ))}
                </div>
                {usable === 0 && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">None of the tabs have headings we can read.</p>}
              </div>
            )}

            {review && (
              <div>
                <div className="flex flex-wrap items-end gap-3">
                  {plans.length > 1 && (
                    <div>
                      <label htmlFor={`${baseId}-review`} className={labelClass}>
                        Tab to check
                      </label>
                      <select
                        id={`${baseId}-review`}
                        value={review.tab}
                        onChange={(e) => setReviewTab(Number(e.target.value))}
                        className={`${inputClass} mt-1`}
                      >
                        {plans.map((p) => (
                          <option key={p.tab} value={p.tab}>
                            {read.tabs[p.tab]?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-expanded={reviewOpen}
                    aria-controls={reviewOpen ? `${baseId}-review-panel` : undefined}
                    onClick={() => setReviewOpen((o) => !o)}
                    className={secondaryButton}
                  >
                    {reviewOpen ? "Hide the columns and rows" : "Check the columns and rows"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {plans.length > 1 ? `${read.tabs[review.tab]?.name}: ` : ""}
                  {previewSummary(review.preview.counts)}
                </p>
                {reviewOpen && typeof tabs[review.tab] === "object" && sheets[review.tab] && (
                  <div id={`${baseId}-review-panel`} className="mt-4">
                    <SheetReview
                      opened={tabs[review.tab] as OpenedSheet}
                      state={sheets[review.tab]}
                      setState={setSheet(review.tab)}
                      preview={review.preview}
                      library={library}
                      match={match}
                      currentYear={currentYear}
                      summary={previewSummary(review.preview.counts)}
                      duplicateIds={NO_DUPLICATES}
                    />
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {fromDownload && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              This file came from a CapexClock download. Each building here becomes a new property. To update a property
              you already have, open it and import the file there.
            </p>
          )}

          <section aria-labelledby={`${baseId}-properties`}>
            <h3 id={`${baseId}-properties`} className={headingClass}>
              Properties to create
            </h3>
            {planned.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Tick a tab with rows to make a property of it.</p>
            ) : (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Check each one&apos;s name, rental units and year built. You can change anything else once it&apos;s created.
              </p>
            )}
            {planned.length > MAX_PROPERTIES && (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                This sheet has {planned.length} buildings. You can create up to {MAX_PROPERTIES} at once, so the first{" "}
                {MAX_PROPERTIES} are ticked. Import the file again for the rest.
              </p>
            )}
            <ol className="mt-3 space-y-3">
              {planned.map((p, i) => {
                const result = results[p.id];
                const created = result?.status === "created";
                const lines = problems.get(p.id) ?? [];
                const on = isIncluded(p, i);
                const showLines = on && !created && lines.length > 0 && (showProblems || lines.some((l) => l !== NO_UNITS_TEXT && l !== NO_NAME_TEXT));
                const problemId = `${baseId}-${i}-problems`;
                const field = (name: keyof PropertyEdits) => `${baseId}-${i}-${name}`;
                const badFields = new Set(propertyFieldProblems(p, currentYear).map((f) => f.field));
                const nameBad = showLines && badFields.has("name");
                const unitsBad = showLines && badFields.has("unitCount");
                const yearBad = showLines && badFields.has("yearBuilt");
                // Each field's name says whose it is, so moving between properties is clear. Each
                // starts with its visible label, so voice control finds it too.
                const whose = p.name.trim() || `property ${i + 1}`;
                const locked = created || running || !on;
                return (
                  <li key={p.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    {planned.length > 1 && (
                      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={created || running || (started && !on)}
                          aria-label={`Create this property: ${p.name.trim() || "no name yet"}`}
                          onChange={(e) => setIncluded((s) => ({ ...s, [p.id]: e.target.checked }))}
                          className="h-4 w-4 accent-amber-500"
                        />
                        <span>Create this property</span>
                      </label>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <div>
                        <label htmlFor={field("name")} className={labelClass}>
                          Property name
                        </label>
                        <input
                          id={field("name")}
                          aria-label={planned.length > 1 ? `Property name, ${i + 1} of ${planned.length}` : undefined}
                          value={p.name}
                          maxLength={200}
                          readOnly={locked}
                          aria-invalid={nameBad || undefined}
                          aria-describedby={showLines ? problemId : undefined}
                          onChange={(e) => edit(p, "name", e.target.value)}
                          className={`${inputClass} ${lockedClass} mt-1`}
                        />
                      </div>
                      <div>
                        <label htmlFor={field("unitCount")} className={labelClass}>
                          Rental units
                        </label>
                        <input
                          id={field("unitCount")}
                          aria-label={`Rental units for ${whose}`}
                          value={p.unitCount}
                          inputMode="numeric"
                          readOnly={locked}
                          aria-invalid={unitsBad || undefined}
                          aria-describedby={showLines ? problemId : undefined}
                          onChange={(e) => edit(p, "unitCount", e.target.value)}
                          className={`${inputClass} ${lockedClass} mt-1 tabular-nums`}
                        />
                      </div>
                      <div>
                        <label htmlFor={field("yearBuilt")} className={labelClass}>
                          Year built
                        </label>
                        <input
                          id={field("yearBuilt")}
                          aria-label={`Year built for ${whose}`}
                          value={p.yearBuilt}
                          inputMode="numeric"
                          placeholder="Optional"
                          readOnly={locked}
                          aria-invalid={yearBad || undefined}
                          aria-describedby={showLines ? problemId : undefined}
                          onChange={(e) => edit(p, "yearBuilt", e.target.value)}
                          className={`${inputClass} ${lockedClass} mt-1 tabular-nums`}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {p.rows.length} {p.rows.length === 1 ? "component" : "components"}
                      {plans.length > 1 || (read.source === "xlsx" && read.tabs.length > 1) ? `, from the ${read.tabs[p.tab]?.name} tab` : ""}
                    </p>
                    {p.notes.map((n) => (
                      <p key={n} className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                        {n}
                      </p>
                    ))}
                    {showLines && (
                      <ul id={problemId} className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-300">
                        {lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {result?.status === "created" && (
                      <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                        Created.{" "}
                        <Link
                          href={`/app/properties/${result.propertyId}`}
                          className="font-medium underline underline-offset-2"
                        >
                          Open {p.name}
                        </Link>
                        {result.detailsDropped && <span className="block text-amber-800 dark:text-amber-300">{DETAILS_NOT_SAVED_TEXT}</span>}
                      </p>
                    )}
                    {result?.status === "failed" && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-300">Didn&apos;t save. {CREATE_FAILURE_TEXT[result.failure]}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            {sheetYearBad && (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Fix the year the sheet was last updated (under Check the columns and rows) to create these.
              </p>
            )}
            {showProblems && blocked && (
              <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">
                Some properties need something fixed first. It&apos;s listed under each one.
              </p>
            )}
            <p role="status" className="text-sm text-slate-700 empty:hidden dark:text-slate-300">
              {progress}
            </p>
            <p
              id={resultId}
              ref={resultRef}
              tabIndex={-1}
              className="text-sm font-medium text-slate-900 empty:hidden focus:outline-none dark:text-white"
            >
              {running ? "" : summary}
            </p>
            <div className="flex flex-wrap gap-3">
              {toCreate.length > 0 && !started && (
                <button
                  type="button"
                  onClick={() => void create(false)}
                  disabled={running || chosen.length > MAX_PROPERTIES}
                  className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createLabel(toCreate.length)}
                </button>
              )}
              {started && failed.length > 0 && (
                <button
                  type="button"
                  onClick={() => void create(true)}
                  disabled={running}
                  className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retry failed ({failed.length})
                </button>
              )}
              <button type="button" onClick={onClose} disabled={running} className={secondaryButton}>
                {started && failed.length === 0 ? "Done" : "Cancel"}
              </button>
            </div>
            {chosen.length > MAX_PROPERTIES && (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Untick {chosen.length - MAX_PROPERTIES} to create {MAX_PROPERTIES} now.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
