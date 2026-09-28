// Static illustration of the forecast output. Numbers are made up.

const SERIES = [
  { key: "roof", label: "Roof", color: "#f59e0b" },
  { key: "hvac", label: "HVAC", color: "#0ea5e9" },
  { key: "water", label: "Water heaters", color: "#10b981" },
  { key: "other", label: "Other", color: "#94a3b8" },
] as const;

type Key = (typeof SERIES)[number]["key"];

// Annual spend in $k per component.
const YEARS: { year: number; values: Record<Key, number> }[] = [
  { year: 2027, values: { roof: 0, hvac: 0, water: 4, other: 2 } },
  { year: 2028, values: { roof: 0, hvac: 12, water: 0, other: 3 } },
  { year: 2029, values: { roof: 0, hvac: 0, water: 5, other: 2 } },
  { year: 2030, values: { roof: 38, hvac: 0, water: 0, other: 4 } },
  { year: 2031, values: { roof: 0, hvac: 8, water: 3, other: 2 } },
  { year: 2032, values: { roof: 0, hvac: 0, water: 0, other: 6 } },
  { year: 2033, values: { roof: 0, hvac: 18, water: 5, other: 3 } },
  { year: 2034, values: { roof: 0, hvac: 0, water: 0, other: 2 } },
  { year: 2035, values: { roof: 0, hvac: 0, water: 6, other: 9 } },
  { year: 2036, values: { roof: 14, hvac: 6, water: 0, other: 3 } },
];

const W = 560;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 40 };
const MAX = 50;
const TICKS = [0, 10, 20, 30, 40, 50];

export default function ForecastMockup() {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / YEARS.length;
  const barW = band * 0.6;
  const y = (v: number) => PAD.top + plotH - (v / MAX) * plotH;

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Maple St. Apartments · 12 units</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">10-year replacement forecast</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-3.5 py-2 text-right ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Recommended reserve
          </p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white">
            $108<span className="text-sm font-normal text-slate-600 dark:text-slate-400"> /unit/mo</span>
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 h-auto w-full"
        role="img"
        aria-label="Example stacked bar chart of annual replacement costs from 2027 to 2036, with a roof replacement spike in 2030."
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

        {YEARS.map((d, i) => {
          const x = PAD.left + i * band + (band - barW) / 2;
          let acc = 0;
          return (
            <g key={d.year}>
              {SERIES.map((s) => {
                const v = d.values[s.key];
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
                {`'${String(d.year).slice(2)}`}
              </text>
            </g>
          );
        })}

        {/* Callout on the 2030 roof spike */}
        <g>
          <text
            x={PAD.left + 3 * band + band / 2}
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
        <span className="ml-auto text-slate-500 dark:text-slate-400">Example data</span>
      </figcaption>
    </figure>
  );
}
