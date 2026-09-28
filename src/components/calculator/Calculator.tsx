"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import ExportButtons from "@/components/export/ExportButtons";
import { computeForecast } from "@/lib/forecast";
import { track } from "@/lib/analytics";
import {
  COMPONENT_LIBRARY,
  UNIT_LABEL_TEXT,
  type LibraryComponent,
} from "@/lib/library/components";
import {
  customRow,
  exampleDraft,
  EMPTY_DRAFT,
  STORAGE_KEY as DRAFT_STORAGE_KEY,
  loadDraft,
  PROBLEM_TEXT,
  parseUnitCount,
  rowFromLibrary,
  saveDraft,
  toComponents,
  withUnitCount,
  type Draft,
  type DraftRow,
} from "./draft";
import ForecastChart from "./ForecastChart";
import { formatMoney } from "./format";

const CUSTOM = "__custom__";

function groupByCategory(library: LibraryComponent[]): Record<string, LibraryComponent[]> {
  return library.reduce<Record<string, LibraryComponent[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});
}

const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

/** The public calculator: work is kept in this browser until it's saved to an account. */
export default function Calculator({
  accountsEnabled = false,
  library = COMPONENT_LIBRARY,
}: {
  accountsEnabled?: boolean;
  library?: LibraryComponent[];
}) {
  // Rendered client-only (see CalculatorLoader), so browser APIs are safe here.
  const [draft, setDraft] = useState<Draft>(loadDraft);
  useEffect(() => saveDraft(draft), [draft]);
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
      trackEvents
      showExample
      footer={accountsEnabled && draft.rows.length > 0 ? <SaveToAccount /> : null}
    />
  );
}

function SaveToAccount() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Save this property to a free account to keep it, add more buildings and see your whole
        portfolio.
      </p>
      <Link
        href="/app/properties/new?from=calculator"
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
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
  /** Components offered in the picker; defaults to the built-in library. */
  library?: LibraryComponent[];
  /** Notes by row id that replace the row's forecast note, e.g. why it can't be saved. */
  rowNotes?: Record<string, string>;
}

export function CalculatorView({
  draft,
  setDraft,
  trackEvents = false,
  showExample = false,
  header,
  footer,
  exportName = "My property",
  library = COMPONENT_LIBRARY,
  rowNotes,
}: CalculatorViewProps) {
  const libraryBySlug = useMemo(() => new Map(library.map((c) => [c.slug, c])), [library]);
  const libraryGroups = useMemo(() => groupByCategory(library), [library]);
  const [startYear] = useState(() => new Date().getFullYear());
  const tracked = useRef({ started: !trackEvents || draft.rows.length > 0, generated: !trackEvents });

  const { components, problems } = useMemo(() => toComponents(draft, startYear), [draft, startYear]);
  const unitCount = parseUnitCount(draft.unitCount);
  const forecast = useMemo(
    () => computeForecast({ startYear, unitCount, components }),
    [startYear, unitCount, components],
  );

  useEffect(() => {
    if (forecast.total > 0 && !tracked.current.generated) {
      tracked.current.generated = true;
      void track("forecast_generated", { components: String(components.length) });
    }
  }, [forecast.total, components.length]);

  function markStarted(source: string) {
    if (tracked.current.started) return;
    tracked.current.started = true;
    void track("calculator_started", { source });
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateRow(id: string, patch: Partial<DraftRow>) {
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function removeRow(id: string) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
  }

  function addComponent(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    event.target.value = "";
    if (!value) return;
    const item = libraryBySlug.get(value);
    const row = item ? rowFromLibrary(item, draft.unitCount) : customRow();
    setDraft((d) => ({ ...d, rows: [...d.rows, row] }));
    markStarted("add_component");
  }

  function loadExample() {
    setDraft(exampleDraft());
    markStarted("example");
  }

  const incomplete = Object.keys(problems).length;

  return (
    <div className="space-y-8">
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
                onClick={() => setDraft(EMPTY_DRAFT)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Year built fills in any install year you leave blank, marked as an estimate.
        </p>
      </section>

      {/* Components */}
      <section className={cardClass} aria-labelledby="components-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="components-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
            Components
          </h2>
          <label className="flex items-center gap-2">
            <span className="sr-only">Add a component</span>
            <select
              defaultValue=""
              onChange={addComponent}
              className={`${inputClass} w-64 font-medium`}
            >
              <option value="" disabled>
                + Add a component…
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
          </label>
        </div>

        {draft.rows.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Add your roofs, HVAC, water heaters and other big-ticket items, or load an example to
            see how it works.
          </p>
        ) : (
          <div className="mt-5">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto_auto] gap-3 border-b border-slate-200 pb-2 lg:grid dark:border-slate-800">
              {["Component", "Quantity", "Installed", "Life (yrs)", "Cost each", "Replace now", ""].map(
                (h) => (
                  <span key={h} className={labelClass}>
                    {h}
                  </span>
                ),
              )}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {draft.rows.map((row) => (
                <ComponentRow
                  key={row.id}
                  row={row}
                  yearBuilt={draft.yearBuilt}
                  lib={row.librarySlug ? libraryBySlug.get(row.librarySlug) : undefined}
                  problem={rowNotes?.[row.id] ?? (problems[row.id] ? PROBLEM_TEXT[problems[row.id]] : null)}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Results */}
      {components.length > 0 && (
        <section aria-labelledby="forecast-heading" className="space-y-6">
          <h2 id="forecast-heading" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Your {forecast.startYear}–{forecast.endYear} forecast
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Monthly reserve" value={formatMoney(forecast.monthlyReserve)} emphasis />
            <Stat
              label="Per unit, per month"
              value={
                forecast.monthlyReservePerUnit === null
                  ? "Add units"
                  : formatMoney(forecast.monthlyReservePerUnit)
              }
              emphasis
            />
            <Stat label={`Needed in ${forecast.startYear}`} value={formatMoney(forecast.neededNow)} />
            <Stat label="10-year total" value={formatMoney(forecast.total)} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The monthly reserve is the smallest steady amount that has the cash ready for every
            replacement from {forecast.startYear + 1} on, looking 30 years ahead.{" "}
            {forecast.startYear} costs (overdue or due this year) are shown separately because
            there&apos;s no time to save for them.
          </p>
          {incomplete > 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {incomplete} component{incomplete === 1 ? " isn't" : "s aren't"} included yet. See the
              notes above.
            </p>
          )}

          <div className={cardClass}>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
              Replacement costs by year
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              In today&apos;s dollars, no inflation.
            </p>
            <ForecastChart forecast={forecast} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <AtRisk forecast={forecast} />
            <DueTable forecast={forecast} />
          </div>

          <ExportButtons
            name={exportName}
            unitCount={unitCount}
            forecast={forecast}
            components={components}
          />
        </section>
      )}
      {footer}
    </div>
  );
}

function ComponentRow({
  row,
  yearBuilt,
  lib,
  problem,
  onChange,
  onRemove,
}: {
  row: DraftRow;
  yearBuilt: string;
  lib: LibraryComponent | undefined;
  problem: string | null;
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}) {
  const label = row.name || "this component";

  return (
    <li className="py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto_auto] lg:items-center">
        <label className="col-span-2 block sm:col-span-3 lg:col-span-1">
          <span className={`${labelClass} lg:sr-only`}>Component</span>
          <input
            className={`${inputClass} mt-1 font-medium lg:mt-0`}
            value={row.name}
            maxLength={200}
            placeholder="e.g. Elevator"
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{row.category}</span>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className={`${labelClass} lg:sr-only`}>Quantity</span>
          <div className="mt-1 flex items-center gap-2 lg:mt-0">
            <input
              className={inputClass}
              inputMode="decimal"
              value={row.quantity}
              aria-label={`Quantity of ${label}`}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
            <select
              value={row.unitLabel}
              aria-label={`How ${label} is counted`}
              onChange={(e) => onChange({ unitLabel: e.target.value as DraftRow["unitLabel"] })}
              className="rounded-md border-0 bg-transparent py-1 text-xs text-slate-600 focus:ring-2 focus:ring-amber-500/30 dark:text-slate-400"
            >
              {Object.entries(UNIT_LABEL_TEXT).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="block">
          <span className={`${labelClass} lg:sr-only`}>Installed</span>
          <input
            className={`${inputClass} mt-1 lg:mt-0`}
            inputMode="numeric"
            value={row.installYear}
            placeholder={yearBuilt ? `${yearBuilt} (est.)` : "Year"}
            aria-label={`Install year of ${label}`}
            onChange={(e) => onChange({ installYear: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={`${labelClass} lg:sr-only`}>Life (yrs)</span>
          <input
            className={`${inputClass} mt-1 lg:mt-0`}
            inputMode="numeric"
            value={row.usefulLife}
            aria-label={`Useful life of ${label} in years`}
            onChange={(e) => onChange({ usefulLife: e.target.value })}
          />
          {lib && (
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Typical {lib.lifeLow}–{lib.lifeHigh}
            </span>
          )}
        </label>
        <label className="block">
          <span className={`${labelClass} lg:sr-only`}>Cost each</span>
          <div className="relative mt-1 lg:mt-0">
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-500">
              $
            </span>
            <input
              className={`${inputClass} pl-6`}
              inputMode="decimal"
              value={row.costEach}
              placeholder="Your cost"
              aria-label={`Replacement cost ${UNIT_LABEL_TEXT[row.unitLabel]} for ${label}`}
              onChange={(e) => onChange({ costEach: e.target.value })}
            />
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 lg:justify-center dark:text-slate-300">
          <input
            type="checkbox"
            checked={row.scenario === "replace_now"}
            onChange={(e) => onChange({ scenario: e.target.checked ? "replace_now" : "run_to_failure" })}
            className="h-4 w-4 accent-amber-500"
          />
          <span className="lg:sr-only">Replace now</span>
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="justify-self-end rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          Remove
        </button>
      </div>
      {problem && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{problem}</p>}
    </li>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
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
    </div>
  );
}

function AtRisk({ forecast }: { forecast: ReturnType<typeof computeForecast> }) {
  return (
    <div className={cardClass}>
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">At risk</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">Past end of life or within 2 years of it.</p>
      {forecast.atRisk.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Nothing is close to end of life.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {forecast.atRisk.map((item) => (
            <li key={item.componentId} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-slate-900 dark:text-white">
                {item.name}
                {item.installYearIsEstimate && (
                  <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">(install year estimated)</span>
                )}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.status === "overdue"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {item.status === "overdue"
                  ? `Past due since ${item.endOfLifeYear}`
                  : `Due ${item.endOfLifeYear}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DueTable({ forecast }: { forecast: ReturnType<typeof computeForecast> }) {
  const rows = forecast.years.flatMap((y) => y.replacements);
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
                      <span className="ml-1.5 text-xs text-red-700 dark:text-red-400">overdue</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-900 dark:text-white">
                    {formatMoney(r.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
