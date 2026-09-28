"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { formatMoney } from "@/components/calculator/format";
import { summarizePortfolio } from "@/lib/properties/portfolio";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";

function subscribe(): () => void {
  return () => {};
}

/** Says which properties the per-unit figure leaves out. */
function missingUnitsNote(properties: PropertyRow[]): string {
  if (properties.length > 3) return `Leaves out ${properties.length} properties with no unit count.`;
  const names = properties.map((p) => p.name);
  if (names.length === 1) return `Leaves out ${names[0]}, which has no unit count.`;
  return `Leaves out ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}, which have no unit count.`;
}

/**
 * Portfolio totals and property cards. Forecasts use the browser's year, like the
 * property editor, so both pages agree around New Year. The server's year is only
 * used for the first paint.
 */
export default function Portfolio({
  properties,
  components,
  serverYear,
}: {
  properties: PropertyRow[];
  components: ComponentRow[];
  serverYear: number;
}) {
  const startYear = useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => serverYear);
  const { summaries, totals } = useMemo(
    () => summarizePortfolio(properties, components, startYear),
    [properties, components, startYear],
  );
  const missing = totals.missingUnits;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly reserve, all properties" value={formatMoney(totals.monthly)} emphasis />
        <Stat
          label="Per unit, per month"
          value={totals.perUnit === null ? "Add units" : formatMoney(totals.perUnit)}
          note={totals.perUnit !== null && missing.length > 0 ? missingUnitsNote(missing) : undefined}
          emphasis
        />
        <Stat label={`Needed in ${startYear}`} value={formatMoney(totals.neededNow)} />
        <Stat label="Items at risk" value={String(totals.atRisk)} />
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {summaries.map(({ property, forecast, excluded, componentCount }) => (
          <li key={property.id}>
            <Link
              href={`/app/properties/${property.id}`}
              className={`${card} block transition hover:border-amber-400 dark:hover:border-amber-500`}
            >
              <p className="text-lg font-semibold text-slate-950 dark:text-white">{property.name}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {property.unit_count > 0
                  ? `${property.unit_count} unit${property.unit_count === 1 ? "" : "s"}`
                  : "No unit count"}{" "}
                · {componentCount} component{componentCount === 1 ? "" : "s"}
                {excluded > 0 && ` · ${excluded} missing a cost or year`}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Monthly</dt>
                  <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">
                    {formatMoney(forecast.monthlyReserve)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Per unit</dt>
                  <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">
                    {forecast.monthlyReservePerUnit === null ? "–" : formatMoney(forecast.monthlyReservePerUnit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Needed {startYear}</dt>
                  <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">
                    {formatMoney(forecast.neededNow)}
                  </dd>
                </div>
              </dl>
              {forecast.atRisk.length > 0 && (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
                  {forecast.atRisk.length} at risk: {forecast.atRisk.slice(0, 3).map((a) => a.name).join(", ")}
                  {forecast.atRisk.length > 3 && "…"}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Stat({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
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
      {note && (
        <p className={`mt-1 text-xs ${emphasis ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>{note}</p>
      )}
    </div>
  );
}
