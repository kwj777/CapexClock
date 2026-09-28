import Link from "next/link";
import ImportDraftPrompt from "@/components/account/ImportDraftPrompt";
import { formatMoney, formatReserve } from "@/components/calculator/format";
import { forecastForProperty } from "@/lib/properties/convert";
import { createClient } from "@/lib/supabase/server";

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const [{ data: properties, error }, { data: components }] = await Promise.all([
    supabase.from("properties").select("*").order("created_at"),
    supabase.from("components").select("*"),
  ]);
  if (error) throw new Error("Couldn't load your properties.");

  const startYear = new Date().getFullYear();
  const summaries = (properties ?? []).map((property) => {
    const own = (components ?? []).filter((c) => c.property_id === property.id);
    const { forecast, excluded } = forecastForProperty(property, own, startYear);
    return { property, forecast, excluded, componentCount: own.length };
  });
  const totals = summaries.reduce(
    (t, s) => ({
      units: t.units + s.property.unit_count,
      monthly: t.monthly + s.forecast.monthlyReserve,
      neededNow: t.neededNow + s.forecast.neededNow,
      atRisk: t.atRisk + s.forecast.atRisk.length,
    }),
    { units: 0, monthly: 0, neededNow: 0, atRisk: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">My properties</h1>
        <Link
          href="/app/properties/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Add a property
        </Link>
      </div>

      <ImportDraftPrompt />

      {summaries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="text-lg font-medium text-slate-900 dark:text-white">No properties yet</p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Add your first building to see its replacement forecast and monthly reserve.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Monthly reserve, all properties" value={formatReserve(totals.monthly)} emphasis />
            <Stat
              label="Per unit, per month"
              value={totals.units > 0 ? formatReserve(totals.monthly / totals.units) : "Add units"}
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
                    {property.unit_count} units · {componentCount} components
                    {excluded > 0 && ` · ${excluded} missing a cost or year`}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Monthly</dt>
                      <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">
                        {formatReserve(forecast.monthlyReserve)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Per unit</dt>
                      <dd className="font-semibold tabular-nums text-slate-950 dark:text-white">
                        {forecast.monthlyReservePerUnit === null ? "–" : formatReserve(forecast.monthlyReservePerUnit)}
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
      )}
    </div>
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
