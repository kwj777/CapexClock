"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatCostRange } from "@/components/calculator/format";
import { track } from "@/lib/analytics";
import type { LibraryComponent, TypicalCost } from "@/lib/library/components";
import {
  ASSUMPTION_SOURCES,
  TYPICAL_COST_SOURCES,
  typicalCostBasis,
  type CostSource,
} from "@/lib/library/typical-cost-sources";
import {
  ESTIMATE_BUILDING_UNITS,
  FLOOR_SQ_FT_PER_APARTMENT,
  GIVE_OR_TAKE_YEARS,
  PARKING_SQ_FT_PER_APARTMENT,
  quickEstimate,
  quickSystems,
  readQuickInputs,
  SPREAD_REPLACEMENTS,
  TICKED_BY_DEFAULT,
  type QuickSystem,
} from "@/lib/reserve/quick-estimate";
import { estimateText, quickPrompt } from "./estimate-text";

const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400";
const label = "text-xs font-medium text-slate-600 dark:text-slate-400";
const link = "font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

/** Library categories in library order, each with its systems. */
function byCategory(systems: QuickSystem[]): [string, QuickSystem[]][] {
  const groups = new Map<string, QuickSystem[]>();
  for (const s of systems) groups.set(s.item.category, [...(groups.get(s.item.category) ?? []), s]);
  return [...groups];
}

/** A per-unit monthly range from the building's size, age and systems, priced at typical costs. */
export default function QuickEstimate({
  library,
  typicalCosts,
}: {
  library: LibraryComponent[];
  typicalCosts: TypicalCost[];
}) {
  const systems = useMemo(() => quickSystems(library, typicalCosts), [library, typicalCosts]);
  const [units, setUnits] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(systems.map((s) => s.item.slug).filter((slug) => TICKED_BY_DEFAULT.has(slug))),
  );
  // A year built is only checked once the owner leaves the field, so typing "1998" never flags "19".
  const [editingYear, setEditingYear] = useState(false);
  const [currentYear] = useState(() => new Date().getFullYear());
  const baseId = useId();
  const unitsErrorId = `${baseId}-units-error`;
  const yearErrorId = `${baseId}-year-error`;

  const inputs = readQuickInputs(units, yearBuilt, currentYear);
  const showYearProblem = inputs.yearBuiltProblem !== null && !editingYear;
  const estimate = useMemo(
    () =>
      inputs.units !== null && inputs.yearBuilt !== null
        ? quickEstimate(systems, ticked, inputs.units, inputs.yearBuilt, currentYear)
        : null,
    [systems, ticked, inputs.units, inputs.yearBuilt, currentYear],
  );
  const shown =
    estimate && inputs.units !== null
      ? { systems: estimate.systems, units: inputs.units, text: estimateText(estimate, inputs.units) }
      : null;
  const prompt = quickPrompt(inputs, showYearProblem);

  // Screen readers hear the new range once typing pauses, not on every keystroke,
  // and nothing until the owner changes something.
  const summary = shown ? shown.text.spoken : prompt;
  const [spoken, setSpoken] = useState("");
  const spokenSummary = useRef(summary);
  useEffect(() => {
    if (summary === spokenSummary.current) return;
    const timer = window.setTimeout(() => {
      spokenSummary.current = summary;
      setSpoken(summary);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [summary]);

  // Once per page view, after an estimate has stayed on screen for a moment, so
  // typing a unit count digit by digit doesn't send it early.
  const sent = useRef(false);
  const shownSystems = shown?.systems ?? null;
  useEffect(() => {
    if (shownSystems === null || sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = true;
      void track("quick_estimate_shown", { systems: String(shownSystems) });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [summary, shownSystems]);

  function toggle(slug: string, on: boolean) {
    setTicked((t) => {
      const next = new Set(t);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  if (systems.length === 0) {
    // No library item has a typical cost: they've all been taken out in the dashboard.
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Quick estimate</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The quick estimate isn&apos;t available right now.{" "}
          <Link href="/capex-calculator" className={link}>
            The full CapEx calculator
          </Link>{" "}
          works from your own costs and dates.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </p>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Quick estimate</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Enter your building&apos;s size and age, and untick any system it doesn&apos;t have. We price each one at
        typical costs.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <label>
          <span className={label}>Rental units</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder="e.g. 12"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            aria-invalid={inputs.unitsProblem !== null || undefined}
            aria-describedby={inputs.unitsProblem ? unitsErrorId : undefined}
          />
        </label>
        <label>
          <span className={label}>Year built</span>
          <input
            className={input}
            inputMode="numeric"
            placeholder="e.g. 1998"
            value={yearBuilt}
            onChange={(e) => setYearBuilt(e.target.value)}
            onFocus={() => setEditingYear(true)}
            onBlur={() => setEditingYear(false)}
            aria-invalid={showYearProblem || undefined}
            aria-describedby={showYearProblem ? yearErrorId : undefined}
          />
        </label>
        {inputs.unitsProblem && (
          <p id={unitsErrorId} className="col-span-2 text-xs text-red-700 dark:text-red-400">
            {inputs.unitsProblem}
          </p>
        )}
        {showYearProblem && (
          <p id={yearErrorId} className="col-span-2 text-xs text-red-700 dark:text-red-400">
            {inputs.yearBuiltProblem}
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
        {shown ? (
          <>
            <p className={label}>Save each month, per unit</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">{shown.text.perUnit}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              That&apos;s {shown.text.building} a month for{" "}
              {shown.units === 1 ? "the 1 unit" : `all ${shown.units.toLocaleString("en-US")} units`}, from typical costs
              for {shown.systems === 1 ? "1 system" : `${shown.systems} systems`}.
            </p>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              These are typical costs, not quotes. Your building&apos;s real costs and install years can move this a lot
              either way.{" "}
              <Link href="/capex-calculator" className={link}>
                Use the full CapEx calculator
              </Link>{" "}
              with your own costs and dates for a number to plan on.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">{prompt}</p>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Already have quotes and install years?{" "}
              <Link href="/capex-calculator" className={link}>
                The full CapEx calculator
              </Link>{" "}
              uses your own numbers.
            </p>
          </>
        )}
      </div>

      <fieldset className="mt-8 min-w-0">
        <legend className="text-base font-semibold text-slate-950 dark:text-white">
          Which systems does the building have?
        </legend>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Typical installed costs in today&apos;s dollars, from the cost guides named under each one. A heat pump heats
          and cools, so untick central AC if heat pumps do the cooling.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Systems and their typical replacement costs</caption>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className={`${label} py-2 pr-2`}>
                System
              </th>
              <th scope="col" className={`${label} py-2 pr-2`}>
                Typical cost
              </th>
              <th scope="col" className={`${label} py-2`}>
                Lasts
              </th>
            </tr>
          </thead>
          {byCategory(systems).map(([category, items]) => (
            <tbody key={category} className="border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="pt-4 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  {category}
                </th>
              </tr>
              {items.map((s) => (
                <tr key={s.item.slug}>
                  <td className="py-2 pr-2 align-top">
                    <label className="flex items-start gap-2 text-slate-900 dark:text-white">
                      <input
                        type="checkbox"
                        checked={ticked.has(s.item.slug)}
                        onChange={(e) => toggle(s.item.slug, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
                      />
                      <span>{s.item.name}</span>
                    </label>
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <span className="tabular-nums text-slate-900 dark:text-white">
                      {formatCostRange(s.cost.low, s.cost.high)}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {s.cost.per === "apartment" ? "per apartment" : `per sq ft, ${s.perApartment} sq ft per apartment`}
                    </span>
                    <Basis text={typicalCostBasis(s.cost)} />
                    <Sources sources={TYPICAL_COST_SOURCES.get(s.item.slug)} />
                  </td>
                  <td className="py-2 align-top tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {s.item.lifeLow}–{s.item.lifeHigh} yrs
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </fieldset>

      <section className="mt-8" aria-labelledby={`${baseId}-how`}>
        <h3 id={`${baseId}-how`} className="text-base font-semibold text-slate-950 dark:text-white">
          How the estimate works
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>
            {SPREAD_REPLACEMENTS
              ? `Each system you tick has been replaced on schedule since the building was built. No two last exactly the same time, so each one's replacements are spread across its typical lifespan, up to ${GIVE_OR_TAKE_YEARS} years early or late, rather than all landing in one year. Nothing is overdue.`
              : "Each system you tick has been replaced on schedule since the building was built, at the middle of its typical lifespan. So nothing is overdue."}
          </li>
          <li>
            The monthly amount is worked out like the full calculator&apos;s: the smallest steady amount, starting from
            nothing saved, that has the cash ready for every replacement after this year, looking 30 years ahead. A
            system due in the next year or two raises it a lot.
          </li>
          <li>The low figure uses every low cost, and the high figure every high cost. No inflation.</li>
          <li>
            Costs for the whole building, like the roof, are shared out per apartment for a{" "}
            {`${ESTIMATE_BUILDING_UNITS}-unit`}, two-story building. A bigger building usually costs less per apartment,
            and a smaller one more.
          </li>
          <li>
            Carpet and vinyl plank cover {FLOOR_SQ_FT_PER_APARTMENT} sq ft per apartment: a 900 sq ft apartment (
            <SourceLink source={ASSUMPTION_SOURCES.apartmentSize} />) less its kitchen and bathroom. Parking is{" "}
            {PARKING_SQ_FT_PER_APARTMENT} sq ft per apartment: 1.5 spaces (
            <SourceLink source={ASSUMPTION_SOURCES.parkingSpaces} />) of about 325 sq ft each, driving lanes included (
            <SourceLink source={ASSUMPTION_SOURCES.parkingArea} />
            ).
          </li>
          <li>If you tick more than one kind of roof, heating, water heater or floor, each covers an equal share.</li>
        </ul>
      </section>
    </div>
  );
}

function SourceLink({ source }: { source: CostSource }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
      {source.name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function Basis({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="block text-xs text-slate-500 dark:text-slate-400">Based on {text}</span>;
}

function Sources({ sources }: { sources: readonly CostSource[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <span className="block text-xs text-slate-500 dark:text-slate-400">
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((source, i) => (
        <span key={source.url}>
          {i > 0 && ", "}
          <SourceLink source={source} />
        </span>
      ))}
    </span>
  );
}
