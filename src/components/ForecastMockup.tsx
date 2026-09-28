// Static illustration of the forecast output. The spending is made up; the
// reserve figure is worked out from it the same way the calculator does.

import { levelMonthlyReserve, type ForecastYear } from "@/lib/forecast";

const SERIES = [
  { key: "roof", label: "Roof", color: "#f59e0b" },
  { key: "hvac", label: "HVAC", color: "#0ea5e9" },
  { key: "water", label: "Water heaters", color: "#10b981" },
  { key: "other", label: "Other", color: "#94a3b8" },
] as const;

type Key = (typeof SERIES)[number]["key"];

// Annual spend in $k per component, starting this year.
export const MOCKUP_SPEND: Record<Key, number>[] = [
  { roof: 0, hvac: 0, water: 4, other: 2 },
  { roof: 0, hvac: 12, water: 0, other: 3 },
  { roof: 0, hvac: 0, water: 5, other: 2 },
  { roof: 38, hvac: 0, water: 0, other: 4 },
  { roof: 0, hvac: 8, water: 3, other: 2 },
  { roof: 0, hvac: 0, water: 0, other: 6 },
  { roof: 0, hvac: 18, water: 5, other: 3 },
  { roof: 0, hvac: 0, water: 0, other: 2 },
  { roof: 0, hvac: 0, water: 6, other: 9 },
  { roof: 14, hvac: 6, water: 0, other: 3 },
];
export const MOCKUP_UNITS = 12;
const ROOF_YEAR = 3;

/**
 * The calculator's reserve for this chart, per unit: the smallest level monthly
 * deposit that pays every bill after this year on time. The $38k roof in year
 * four sets it, which a plain 10-year average would miss.
 */
export function mockupReservePerUnit(): number {
  const years: ForecastYear[] = MOCKUP_SPEND.map((values, i) => ({
    year: i,
    total: SERIES.reduce((sum, s) => sum + values[s.key], 0) * 1000,
    byCategory: {},
    replacements: [],
  }));
  return levelMonthlyReserve(years) / MOCKUP_UNITS;
}

const W = 560;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 40 };
const MAX = 50;
const TICKS = [0, 10, 20, 30, 40, 50];

export default function ForecastMockup() {
  const startYear = new Date().getFullYear();
  // Rounded up, like the calculator's figure, so saving it never runs short.
  const reserve = Math.ceil(mockupReservePerUnit());
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / MOCKUP_SPEND.length;
  const barW = band * 0.6;
  const y = (v: number) => PAD.top + plotH - (v / MAX) * plotH;

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Maple St. Apartments · {MOCKUP_UNITS} units
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">10-year replacement forecast</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3.5 py-2 text-right ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Recommended reserve
          </p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white">
            ${reserve}<span className="text-sm font-normal text-slate-600 dark:text-slate-400"> /unit/mo</span>
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 h-auto w-full"
        role="img"
        aria-label={`Example stacked bar chart of annual replacement costs from ${startYear} to ${startYear + MOCKUP_SPEND.length - 1}, with a roof replacement spike in ${startYear + ROOF_YEAR}.`}
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? "stroke-slate-300 dark:stroke-slate-600" : "stroke-slate-200 dark:stroke-slate-800"}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={11}
              className="fill-slate-500 dark:fill-slate-400"
            >
              ${t}k
            </text>
          </g>
        ))}

        {MOCKUP_SPEND.map((values, i) => {
          const x = PAD.left + i * band + (band - barW) / 2;
          let acc = 0;
          return (
            <g key={i}>
              {SERIES.map((s) => {
                const v = values[s.key];
                if (!v) return null;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return (
                  <rect key={s.key} x={x} y={top} width={barW} height={h} fill={s.color} rx={2} />
                );
              })}
              <text
                x={x + barW / 2}
                y={H - PAD.bottom + 17}
                textAnchor="middle"
                fontSize={11}
                className="fill-slate-500 dark:fill-slate-400"
              >
                {`'${String(startYear + i).slice(2)}`}
              </text>
            </g>
          );
        })}

        {/* Callout on the roof spike */}
        <g>
          <text
            x={PAD.left + ROOF_YEAR * band + band / 2}
            y={y(42) - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            className="fill-slate-900 dark:fill-white"
          >
            Roof, $38k
          </text>
        </g>
      </svg>

      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-slate-500">Example data</span>
      </figcaption>
    </figure>
  );
}
