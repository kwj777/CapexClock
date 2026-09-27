"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import type { Forecast } from "@/lib/forecast";
import { CHART_CATEGORIES, chartCategory, type ChartCategory } from "@/lib/library/components";
import { formatCompactMoney, formatMoney } from "./format";

// Color follows the category, never its position in the current data.
const CATEGORY_COLOR: Record<ChartCategory, string> = Object.fromEntries(
  CHART_CATEGORIES.map((c, i) => [c, `var(--series-${i + 1})`]),
) as Record<ChartCategory, string>;

type Row = { year: number } & Partial<Record<ChartCategory, number>>;

function toRows(forecast: Forecast): { rows: Row[]; present: ChartCategory[] } {
  const present = new Set<ChartCategory>();
  const rows = forecast.years.map((y) => {
    const row: Row = { year: y.year };
    for (const [category, cost] of Object.entries(y.byCategory)) {
      const key = chartCategory(category);
      row[key] = (row[key] ?? 0) + cost;
      present.add(key);
    }
    return row;
  });
  return { rows, present: CHART_CATEGORIES.filter((c) => present.has(c)) };
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, number | string>) {
  if (!active || !payload?.length) return null;
  const items = payload.flatMap((p) =>
    typeof p.value === "number" && p.value > 0 ? [{ ...p, value: p.value }] : [],
  );
  const total = items.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-semibold text-slate-900 dark:text-white">
        {label}: {formatMoney(total)}
      </p>
      {items.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}: {formatMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ForecastChart({ forecast }: { forecast: Forecast }) {
  const { rows, present } = toRows(forecast);

  return (
    <div className="viz-root h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={{ stroke: "var(--viz-grid)" }}
            tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--viz-axis)", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactMoney(v)}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }} />
          <Legend
            iconType="square"
            iconSize={10}
            // Keep legend in the fixed category order, not alphabetical.
            itemSorter={(item) => CHART_CATEGORIES.indexOf(item.value as ChartCategory)}
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-slate-600 dark:text-slate-300">{value}</span>
            )}
          />
          {present.map((category) => (
            <Bar
              key={category}
              dataKey={category}
              name={category}
              stackId="cost"
              fill={CATEGORY_COLOR[category]}
              stroke="var(--viz-surface)"
              strokeWidth={2}
              maxBarSize={44}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
