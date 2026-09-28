import { Document, Font, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney } from "@/components/calculator/format";
import { formatCostEach, formatQuantity, moneyColumn } from "@/lib/export/format";
import { ESTIMATED_NOTE, exportRows, leftOutSummary, type ExportDetails } from "@/lib/export/rows";
import type { Forecast, ForecastComponent } from "@/lib/forecast";

// Loaded only when someone clicks "Download PDF" (see ExportButtons), so the
// fonts are only fetched then too.

// The PDF's built-in Helvetica only covers Western European letters. DejaVu Sans
// (public/fonts, license alongside) adds Polish, Czech, Vietnamese, Greek,
// Cyrillic and common symbols. It has no Chinese, Japanese, Korean, Thai or
// Indic characters and no emoji; see printableText.
const font = "DejaVu Sans";
const faces = [{ fontFamily: font }, { fontFamily: font, fontWeight: 700 }];
Font.register({
  family: font,
  fonts: [
    { src: "/fonts/DejaVuSans.ttf" },
    { src: "/fonts/DejaVuSans-Bold.ttf", fontWeight: 700 },
  ],
});

/**
 * Swaps characters the fonts can't draw for "□". Left alone, the PDF falls back
 * to Helvetica for them, which prints garbled, overlapping glyphs.
 */
async function printableText(): Promise<(text: string) => string> {
  await Promise.all(faces.map((face) => Font.load(face)));
  const loaded = faces.map((face) => Font.getFont(face).data);
  const canDraw = (ch: string) =>
    loaded.every((f) => f?.hasGlyphForCodePoint(ch.codePointAt(0) ?? 0) ?? false);
  // Spaces and invisible format characters are left to the layout. An accent
  // or emoji style mark the fonts lack is dropped rather than boxed.
  return (text) => text.replace(/[^\s\p{C}]/gu, (ch) => (canDraw(ch) ? ch : /\p{M}/u.test(ch) ? "" : "□"));
}

/** Renders the PDF once its fonts are loaded. */
export async function forecastPdfBlob(props: Omit<ForecastPdfProps, "printable">): Promise<Blob> {
  const printable = await printableText();
  return pdf(<ForecastPdf {...props} printable={printable} />).toBlob();
}

const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const amber = "#f59e0b";
const warning = "#92400e";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: ink, fontFamily: font },
  brand: { fontSize: 9, color: muted, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "bold" },
  subtitle: { fontSize: 10, color: muted, marginTop: 4 },
  stats: { flexDirection: "row", gap: 8, marginTop: 18 },
  stat: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 6, padding: 10 },
  statLabel: { fontSize: 8, color: muted },
  statValue: { fontSize: 14, fontWeight: "bold", marginTop: 3 },
  leftOut: { fontSize: 9, color: warning, fontWeight: "bold", marginTop: 8, lineHeight: 1.4 },
  h2: { fontSize: 12, fontWeight: "bold", marginTop: 20, marginBottom: 6 },
  note: { fontSize: 8.5, color: muted, marginTop: 6, lineHeight: 1.4 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barYear: { width: 34, fontSize: 9, color: muted },
  barTrack: { flex: 1, height: 10 },
  bar: { height: 10, backgroundColor: amber, borderRadius: 2 },
  barValue: { width: 80, textAlign: "right", fontSize: 9 },
  table: { fontSize: 9 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 4 },
  th: { fontSize: 8, color: muted, fontWeight: "bold" },
  num: { textAlign: "right" },
  noteCell: { flex: 1, paddingLeft: 10, fontSize: 8, color: muted },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: muted, flexDirection: "row", justifyContent: "space-between" },
});

const cols = { year: 32, name: 164, qty: 64, each: 66, total: 70 };

export interface ForecastPdfProps {
  name: string;
  unitCount: number;
  forecast: Forecast;
  components: ForecastComponent[];
  details?: ExportDetails;
  generatedOn: string;
  /** Makes names safe to print; see printableText. */
  printable?: (text: string) => string;
}

export default function ForecastPdf({
  name,
  unitCount,
  forecast,
  components,
  details = {},
  generatedOn,
  printable = (text) => text,
}: ForecastPdfProps) {
  const maxYear = Math.max(1, ...forecast.years.map((y) => y.total));
  const rows = exportRows(forecast, components, details.unitLabels);
  const leftOut = (details.leftOut ?? []).map((l) => ({ ...l, name: printable(l.name) }));
  // Shows cents everywhere when any row has them, so rows add up to the year totals.
  const money = moneyColumn(rows.map((r) => r.total));
  const longTable = rows.length > 12;

  return (
    <Document title={`${name} CapEx forecast`} author="CapexClock">
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>CAPEXCLOCK · CAPEX FORECAST</Text>
        <Text style={s.title}>{printable(name)}</Text>
        <Text style={s.subtitle}>
          {unitCount > 0 ? `${unitCount.toLocaleString("en-US")} ${unitCount === 1 ? "unit" : "units"} · ` : ""}
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
        {leftOut.length > 0 && <Text style={s.leftOut}>{leftOutSummary(leftOut)}</Text>}
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
            <Text style={s.barValue}>{money(y.total)}</Text>
          </View>
        ))}

        {forecast.atRisk.length > 0 && (
          <>
            <Text style={s.h2}>At risk</Text>
            {forecast.atRisk.map((a) => (
              <Text key={a.componentId} style={{ marginBottom: 2 }}>
                {printable(a.name)}:{" "}
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
        <View style={s.table} break={longTable} wrap={longTable}>
          <Text style={s.h2}>What&apos;s due when</Text>
          <View style={s.tr} fixed>
            <Text style={[s.th, { width: cols.year }]}>Year</Text>
            <Text style={[s.th, { width: cols.name }]}>Component</Text>
            <Text style={[s.th, s.num, { width: cols.qty }]}>Qty</Text>
            <Text style={[s.th, s.num, { width: cols.each }]}>Cost each</Text>
            <Text style={[s.th, s.num, { width: cols.total }]}>Total</Text>
            <Text style={[s.th, { flex: 1, paddingLeft: 10 }]}>Note</Text>
          </View>
          {rows.map((r, i) => (
            <View key={`${r.name}-${r.year}-${i}`} style={s.tr} wrap={false}>
              <Text style={{ width: cols.year }}>{r.year}</Text>
              <Text style={{ width: cols.name }}>{printable(r.name)}</Text>
              <Text style={[s.num, { width: cols.qty }]}>{formatQuantity(r)}</Text>
              <Text style={[s.num, { width: cols.each }]}>{formatCostEach(r)}</Text>
              <Text style={[s.num, { width: cols.total }]}>{money(r.total)}</Text>
              <Text style={s.noteCell}>{r.notes.join("; ")}</Text>
            </View>
          ))}
          {rows.length === 0 && <Text style={s.note}>Nothing comes due in these 10 years.</Text>}
          {rows.some((r) => r.notes.includes(ESTIMATED_NOTE)) && (
            <Text style={s.note}>
              {ESTIMATED_NOTE}: no install year was entered, so the building&apos;s year built is used.
            </Text>
          )}
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
