"use client";

import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { track } from "@/lib/analytics";
import { guessedYear } from "@/lib/export/rows";
import {
  compareReplaceNow,
  replacementCost,
  type AtRiskItem,
  type ForecastComponent,
  type ReplaceNowComparison,
} from "@/lib/forecast";
import {
  applyChosen,
  applyLabel,
  appliedText,
  canUndoApply,
  EMERGENCY_HINT,
  EMERGENCY_PERCENT_TEXT,
  emergencyNote,
  eitherWayVariants,
  focusStep,
  ifYouWait,
  itemDetail,
  leadVariants,
  parseEmergencyPercent,
  perUnitText,
  reserveVariants,
  compareSummary,
  togglePanel,
  totalChange,
  undoApplied,
  withTick,
  type CompareAction,
  type CompareState,
} from "./compare";
import type { Draft, DraftRow } from "./draft";
import { formatMoney, formatReserve } from "./format";

const inputClass =
  "block rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";

/** A repeat of the same words wouldn't be read again, so vary it invisibly. */
function sayAgain(current: string, message: string): string {
  return current === message ? `${message}\u00a0` : message;
}

/**
 * "What if we replace everything at risk now?" under the at-risk list. It compares
 * the forecast with a copy where the ticked at-risk rows are set to replace this
 * year. Nothing in the draft changes until Apply, which can be undone. Whether it's
 * open, the ticks, the emergency box and Undo live in `state`, which the calculator
 * keeps for the page view, so they outlast this going away while nothing is at risk.
 */
export default function CompareAtRisk({
  startYear,
  unitCount,
  components,
  rows,
  draft,
  setDraft,
  state,
  setState,
  forecastPending = false,
}: {
  startYear: number;
  unitCount: number;
  /** The forecast's components, as the calculator worked them out from the draft. */
  components: ForecastComponent[];
  /** Form rows by id, for whether an install year was typed and ticked as a guess. */
  rows: ReadonlyMap<string, DraftRow>;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  state: CompareState;
  setState: Dispatch<SetStateAction<CompareState>>;
  /** True while `components` are still from an earlier draft (the calculator defers the forecast). */
  forecastPending?: boolean;
}) {
  const { open, percentText, unticked, applied } = state;
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const panelId = `${baseId}-panel`;
  const undoId = `${baseId}-undo`;
  const applyId = `${baseId}-apply`;
  const [editingPercent, setEditingPercent] = useState(false);
  const [spoken, setSpoken] = useState("");
  // Set when ticking or the emergency box changes the figures; they're read out once that pauses.
  const [speak, setSpeak] = useState(false);
  const focusNext = useRef<string | null>(null);

  const { percent, error: percentError } = parseEmergencyPercent(percentText);
  const comparison = useMemo(
    () =>
      compareReplaceNow(
        { startYear, unitCount, components },
        { only: new Set(components.filter((c) => !unticked.has(c.id)).map((c) => c.id)), emergencyPercent: percent },
      ),
    [startYear, unitCount, components, unticked, percent],
  );
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);
  const summary = compareSummary(comparison, startYear);

  const canUndo = canUndoApply(applied, draft);

  function say(message: string) {
    setSpoken((current) => sayAgain(current, message));
  }

  useEffect(() => {
    if (!speak) return;
    const timer = window.setTimeout(() => {
      setSpeak(false);
      setSpoken((current) => sayAgain(current, summary));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [speak, summary]);

  useEffect(() => {
    if (!focusNext.current) return;
    const target = document.getElementById(focusNext.current);
    const step = focusStep(target instanceof HTMLButtonElement ? target : null, forecastPending);
    if (step === "wait") return;
    if (step === "focus") target?.focus();
    focusNext.current = null;
  });

  function toggle() {
    const next = togglePanel(state, comparison.items.length);
    setState(next.state);
    if (next.event) void track("compare_viewed", next.event);
  }

  function setTicked(id: string, ticked: boolean) {
    setState((s) => withTick(s, id, ticked));
    setSpeak(true);
  }

  function run(action: CompareAction) {
    setState((s) => ({ ...s, applied: action.applied }));
    setDraft(action.draft);
    setSpeak(false);
    say(action.message);
    focusNext.current = { undo: undoId, apply: applyId, toggle: toggleId }[action.focus];
  }

  function apply() {
    const action = applyChosen(draft, comparison.chosen);
    if (!action) return;
    run(action);
    void track("compare_applied", { items: comparison.chosen.length });
  }

  function undo() {
    const action = undoApplied(applied, draft, open);
    if (action) run(action);
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </p>
      <button
        id={toggleId}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
      >
        What if we replace everything at risk now?
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div id={panelId} hidden={!open} className="mt-4">
        {open && (
          <ComparisonPanel
            baseId={baseId}
            applyId={applyId}
            startYear={startYear}
            comparison={comparison}
            byId={byId}
            rows={rows}
            unticked={unticked}
            onTick={setTicked}
            percentText={percentText}
            percent={percent}
            showPercentError={percentError && !editingPercent}
            onPercentChange={(value) => {
              setState((s) => ({ ...s, percentText: value }));
              setSpeak(true);
            }}
            onPercentEditing={setEditingPercent}
            onApply={apply}
          />
        )}
      </div>
      {/* Below the panel, so appearing after Apply doesn't push the panel or Apply down. */}
      {canUndo && (
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
          {appliedText(applied.count)}{" "}
          <button
            id={undoId}
            type="button"
            onClick={undo}
            className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
          >
            Undo
          </button>
        </p>
      )}
    </div>
  );
}

/** The open panel: the figures, the emergency box, the items to tick and Apply. */
export function ComparisonPanel({
  baseId,
  applyId,
  startYear,
  comparison,
  byId,
  rows,
  unticked,
  onTick,
  percentText,
  percent,
  showPercentError,
  onPercentChange,
  onPercentEditing,
  onApply,
}: {
  baseId: string;
  applyId: string;
  startYear: number;
  comparison: ReplaceNowComparison;
  byId: ReadonlyMap<string, ForecastComponent>;
  rows: ReadonlyMap<string, DraftRow>;
  unticked: ReadonlySet<string>;
  onTick: (id: string, ticked: boolean) => void;
  percentText: string;
  percent: number;
  showPercentError: boolean;
  onPercentChange: (value: string) => void;
  onPercentEditing: (editing: boolean) => void;
  onApply: () => void;
}) {
  const { items, chosen, alreadyReplacing, asPlanned, replaceNow } = comparison;
  const percentId = `${baseId}-percent`;
  const percentLabelId = `${baseId}-percent-label`;
  const percentSuffixId = `${baseId}-percent-suffix`;
  const hintId = `${baseId}-percent-hint`;
  const noteId = `${baseId}-percent-note`;
  const errorId = `${baseId}-percent-error`;
  const cash = formatMoney(replaceNow.neededNow);
  const total = totalChange(asPlanned.total, replaceNow.total);
  const monthly = formatReserve(replaceNow.monthlyReserve);
  const perUnit = perUnitText(asPlanned, replaceNow);
  const eitherWay = eitherWayVariants(items, startYear, percent);
  const sure = items.filter((i) => !i.installYearIsEstimate);
  const toCheck = items.filter((i) => i.installYearIsEstimate);
  const shownHint = showPercentError ? errorId : percent > 0 ? noteId : hintId;

  if (items.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Everything at risk is set to Replace this year.</p>;
  }

  const choice = (item: AtRiskItem) => {
    const component = byId.get(item.componentId);
    if (!component) return null;
    const row = rows.get(item.componentId);
    return (
      <li key={item.componentId}>
        <label className="flex items-start gap-2.5 py-1.5 text-sm">
          <input
            type="checkbox"
            checked={!unticked.has(item.componentId)}
            onChange={(e) => onTick(item.componentId, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
          />
          <span className="min-w-0 flex-1">
            <span className="text-slate-900 dark:text-white">{item.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {itemDetail(item, component.installYear, row !== undefined && guessedYear(row))}
            </span>
          </span>
          <span className="shrink-0 tabular-nums text-slate-900 dark:text-white">
            {formatMoney(replacementCost(component))}
          </span>
        </label>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <OneOf
          variants={leadVariants(chosen.length, items.length, startYear)}
          className="text-sm text-slate-700 dark:text-slate-300"
        />
        <dl className="mt-3 space-y-3">
          <Figure
            label={`Cash needed in ${startYear}`}
            value={cash}
            detail={ifYouWait(cash, formatMoney(asPlanned.neededNow))}
          />
          <Figure label="10-year total" value={total.change} detail={total.detail} />
          <Figure
            label="Monthly reserve"
            value={monthly}
            detail={ifYouWait(monthly, formatReserve(asPlanned.monthlyReserve))}
            extra={perUnit}
          />
        </dl>
        <OneOf
          variants={reserveVariants(asPlanned.monthlyReserve, replaceNow.monthlyReserve)}
          className="mt-3 text-sm text-slate-700 dark:text-slate-300"
        />
        {eitherWay.length > 0 && (
          <OneOf variants={eitherWay} className="mt-2 text-sm text-slate-500 dark:text-slate-400" />
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
          <label id={percentLabelId} htmlFor={percentId}>
            Emergency replacements cost
          </label>
          <input
            id={percentId}
            className={`${inputClass} w-20`}
            inputMode="decimal"
            value={percentText}
            aria-labelledby={`${percentLabelId} ${percentSuffixId}`}
            aria-invalid={showPercentError || undefined}
            aria-describedby={shownHint}
            onFocus={() => onPercentEditing(true)}
            onBlur={() => onPercentEditing(false)}
            onChange={(e) => onPercentChange(e.target.value)}
          />
          <span id={percentSuffixId}>% more</span>
        </div>
        {/* The hint, the note and the error share one spot sized for the longest, so
            typing never moves what's below. Until there's a percent, the note is sized with 25. */}
        <OneOf
          className="mt-1.5 text-xs"
          variants={[
            { id: hintId, text: EMERGENCY_HINT, shown: shownHint === hintId, className: "text-slate-500 dark:text-slate-400" },
            {
              id: noteId,
              text: emergencyNote(percent || 25),
              shown: shownHint === noteId,
              className: "text-slate-600 dark:text-slate-300",
            },
            {
              id: errorId,
              text: EMERGENCY_PERCENT_TEXT,
              shown: shownHint === errorId,
              className: "text-amber-800 dark:text-amber-300",
            },
          ]}
        />
      </div>

      {sure.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-950 dark:text-white">Replace in {startYear}</legend>
          <ul className="mt-1">{sure.map(choice)}</ul>
        </fieldset>
      )}
      {toCheck.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-950 dark:text-white">
            Check these install years before applying.
          </legend>
          <ul className="mt-1">{toCheck.map(choice)}</ul>
        </fieldset>
      )}
      {alreadyReplacing > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {alreadyReplacing === 1
            ? "1 more is already set to Replace this year."
            : `${alreadyReplacing} more are already set to Replace this year.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          id={applyId}
          type="button"
          onClick={onApply}
          disabled={chosen.length === 0}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applyLabel(chosen.length)}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Apply ticks Replace this year for the items you chose. Nothing changes until you click it.
        </p>
      </div>
    </div>
  );
}

/** One figure on the replace-now side, with what it is as things stand under it. */
function Figure({ label, value, detail, extra }: { label: string; value: string; detail: string; extra?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</dt>
      <dd>
        <span className="block text-xl font-semibold tabular-nums text-slate-950 dark:text-white">{value}</span>
        <span className="block text-sm tabular-nums text-slate-500 dark:text-slate-400">{detail}</span>
        {extra && <span className="block text-sm tabular-nums text-slate-500 dark:text-slate-400">{extra}</span>}
      </dd>
    </div>
  );
}

interface Variant {
  text: string;
  shown: boolean;
  id?: string;
  className?: string;
}

/** Draws every variant in one spot, sized for the longest, and shows only the one that applies. */
function OneOf({ variants, className }: { variants: Variant[]; className: string }) {
  return (
    <div className={`grid ${className}`}>
      {variants.map((v, i) => (
        <p key={i} id={v.id} className={`col-start-1 row-start-1 ${v.className ?? ""} ${v.shown ? "" : "invisible"}`}>
          {v.text}
        </p>
      ))}
    </div>
  );
}
