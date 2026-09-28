import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, formatUnitPrice } from "@/components/calculator/format";
import type { Forecast, ForecastComponent } from "@/lib/forecast";

// Loaded only when someone clicks "Download PDF" (see ExportButtons).

const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const amber = "#f59e0b";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: ink, fontFamily: "Helvetica" },
  brand: { fontSize: 9, color: muted, marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, color: muted, marginTop: 4 },
  stats: { flexDirection: "row", gap: 8, marginTop: 18 },
  stat: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 6, padding: 10 },
  statLabel: { fontSize: 8, color: muted },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 6 },
  note: { fontSize: 8.5, color: muted, marginTop: 6, lineHeight: 1.4 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barYear: { width: 34, fontSize: 9, color: muted },
  barTrack: { flex: 1, height: 10 },
  bar: { height: 10, backgroundColor: amber, borderRadius: 2 },
  barValue: { width: 70, textAlign: "right", fontSize: 9 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 4 },
  th: { fontSize: 8, color: muted, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: muted, flexDirection: "row", justifyContent: "space-between" },
});

const cols = { year: 40, name: 170, qty: 50, each: 70, total: 80 };

export interface ForecastPdfProps {
  name: string;
  unitCount: number;
  forecast: Forecast;
  components: ForecastComponent[];
  generatedOn: string;
}

export default function ForecastPdf({ name, unitCount, forecast, components, generatedOn }: ForecastPdfProps) {
  const byId = new Map(components.map((c) => [c.id, c]));
  const maxYear = Math.max(1, ...forecast.years.map((y) => y.total));
  const replacements = forecast.years.flatMap((y) => y.replacements);
  const longTable = replacements.length > 12;

  return (
    <Document title={`${name} CapEx forecast`} author="CapexClock">
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>CAPEXCLOCK · CAPEX FORECAST</Text>
        <Text style={s.title}>{name}</Text>
        <Text style={s.subtitle}>
          {unitCount > 0 ? `${unitCount} units · ` : ""}
          {forecast.startYear}–{forecast.endYear} · prepared {generatedOn}
        </Text>

        <View style={s.stats}>
          <Stat label="Monthly reserve" value={formatMoney(forecast.monthlyReserve)} />
          <Stat
            label="Per unit, per month"
            value={forecast.monthlyReservePerUnit === null ? "–" : formatMoney(forecast.monthlyReservePerUnit)}
          />
          <Stat label={`Needed in ${forecast.startYear}`} value={formatMoney(forecast.neededNow)} />
          <Stat label="10-year total" value={formatMoney(forecast.total)} />
        </View>
        <Text style={s.note}>
          The monthly reserve is the smallest steady amount that has the cash ready for every replacement
          from {forecast.startYear + 1} on, looking 30 years ahead. {forecast.startYear} costs (overdue or due
          this year) are listed separately. All figures are in today&apos;s dollars, without inflation.
        </Text>

        <Text style={s.h2}>Replacement costs by year</Text>
        {forecast.years.map((y) => (
          <View key={y.year} style={s.barRow}>
            <Text style={s.barYear}>{y.year}</Text>
            <View style={s.barTrack}>
              {y.total > 0 && <View style={[s.bar, { width: `${(y.total / maxYear) * 100}%` }]} />}
            </View>
            <Text style={s.barValue}>{formatMoney(y.total)}</Text>
          </View>
        ))}

        {forecast.atRisk.length > 0 && (
          <>
            <Text style={s.h2}>At risk</Text>
            {forecast.atRisk.map((a) => (
              <Text key={a.componentId} style={{ marginBottom: 2 }}>
                {a.name}:{" "}
                {a.status === "overdue"
                  ? `${-a.yearsRemaining} yr${a.yearsRemaining === -1 ? "" : "s"} past end of life`
                  : a.yearsRemaining === 0
                    ? "due this year"
                    : `due in ${a.yearsRemaining} yr${a.yearsRemaining === 1 ? "" : "s"}`}
                {a.installYearIsEstimate ? " (install year estimated)" : ""}
              </Text>
            ))}
          </>
        )}

        {/* The header row is fixed inside this view, so it repeats on each page
            the table spans and nowhere else. A short table is kept on one page. */}
        <View break={longTable} wrap={longTable}>
          <Text style={s.h2}>What&apos;s due when</Text>
          <View style={s.tr} fixed>
            <Text style={[s.th, { width: cols.year }]}>Year</Text>
            <Text style={[s.th, { width: cols.name }]}>Component</Text>
            <Text style={[s.th, { width: cols.qty, textAlign: "right" }]}>Qty</Text>
            <Text style={[s.th, { width: cols.each, textAlign: "right" }]}>Cost each</Text>
            <Text style={[s.th, { width: cols.total, textAlign: "right" }]}>Total</Text>
            <Text style={[s.th, { flex: 1, paddingLeft: 10 }]}>Note</Text>
          </View>
          {replacements.map((r, i) => {
            const c = byId.get(r.componentId);
            return (
              <View key={`${r.componentId}-${r.year}-${i}`} style={s.tr} wrap={false}>
                <Text style={{ width: cols.year }}>{r.year}</Text>
                <Text style={{ width: cols.name }}>{r.name}</Text>
                <Text style={{ width: cols.qty, textAlign: "right" }}>{c ? c.quantity.toLocaleString("en-US") : ""}</Text>
                <Text style={{ width: cols.each, textAlign: "right" }}>{c ? formatUnitPrice(c.replacementCostEach) : ""}</Text>
                <Text style={{ width: cols.total, textAlign: "right" }}>{formatMoney(r.cost)}</Text>
                <Text style={{ flex: 1, paddingLeft: 10, color: muted }}>{r.overdue ? "Overdue" : ""}</Text>
              </View>
            );
          })}
          {replacements.length === 0 && <Text style={s.note}>Nothing comes due in these 10 years.</Text>}
        </View>

        <View style={s.footer} fixed>
          <Text>capexclock.com</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
