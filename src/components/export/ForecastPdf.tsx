import { Document, Font, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { CONDITION_TEXT } from "@/components/calculator/draft";
import { formatReserve } from "@/components/calculator/format";
import { formatCostEach, formatQuantity, longWordParts, moneyColumn } from "@/lib/export/format";
import {
  ESTIMATED_NOTE,
  exportRows,
  GUESS_NOTE,
  installYearNote,
  leftOutSummary,
  sumTotals,
  type ConditionNote,
  type ExportDetails,
  type ExportRow,
} from "@/lib/export/rows";
import type { Forecast, ForecastComponent } from "@/lib/forecast";

// Loaded only when someone clicks "Download PDF" (see ExportButtons), so the
// fonts are only fetched then too.

// The PDF's built-in Helvetica only covers Western European letters. DejaVu Sans
// (public/fonts, license alongside) adds Polish, Czech, Vietnamese, Greek,
// Cyrillic and common symbols. It has no Chinese, Japanese, Korean, Thai or
// Indic characters and no emoji; see printableText.
const font = "DejaVu Sans";
const faces = [{ fontFamily: font }, { fontFamily: font, fontWeight: 700 }];
let fontsReady: Promise<void> | null = null;

/**
 * Registers the fonts once both files have arrived. The PDF library keeps a
 * failed download for good, so handing it the URLs would make every later try
 * fail too. Registering the bytes instead lets the next click fetch them again.
 */
function loadFonts(): Promise<void> {
  fontsReady ??= Promise.all([fontData("/fonts/DejaVuSans.ttf"), fontData("/fonts/DejaVuSans-Bold.ttf")])
    .then(([regular, bold]) => {
      Font.register({ family: font, fonts: [{ src: regular }, { src: bold, fontWeight: 700 }] });
    })
    .catch((error: unknown) => {
      fontsReady = null;
      throw error;
    });
  return fontsReady;
}

/** A font file as a data URL. Tries twice, since one dropped request is common on phones. */
async function fontData(src: string, attempts = 2): Promise<string> {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Couldn't load ${src}: ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (attempts <= 1) throw error;
    return fontData(src, attempts - 1);
  }
}

/**
 * Swaps characters the fonts can't draw for "□". Left alone, the PDF falls back
 * to Helvetica for them, which prints garbled, overlapping glyphs.
 */
async function printableText(): Promise<(text: string) => string> {
  await loadFonts();
  await Promise.all(faces.map((face) => Font.load(face)));
  const loaded = faces.map((face) => Font.getFont(face).data);
  const canDraw = (ch: string) =>
    loaded.every((f) => f?.hasGlyphForCodePoint(ch.codePointAt(0) ?? 0) ?? false);
  // Spaces and invisible format characters are left to the layout. An accent
  // or emoji style mark the fonts lack is dropped rather than boxed.
  return (text) => text.replace(/[^\s\p{C}]/gu, (ch) => (canDraw(ch) ? ch : /\p{M}/u.test(ch) ? "" : "□"));
}

/** Renders the PDF once its fonts are loaded. Render it only through here. */
export async function forecastPdfBlob(
  props: Omit<ForecastPdfProps, "printable" | "keepTableTogether">,
): Promise<Blob> {
  const printable = await printableText();
  const { rows, money } = tableData(props);
  // A short table is kept on one page, but only if it fits on one: a block
  // that can't break and is taller than a page squeezes the whole page
  // together. Laying the table out on its own shows whether it fits. If it
  // doesn't, it starts on a new page and runs on, like a long table.
  const keepTableTogether =
    rows.length <= MAX_ROWS_KEPT_TOGETHER &&
    (await pageCount(<DueTable rows={rows} money={money} printable={printable} />)) === 1;
  return pdf(<ForecastPdf {...props} printable={printable} keepTableTogether={keepTableTogether} />).toBlob();
}

/** The table's rows, and the money format the whole PDF uses. */
function tableData({ forecast, components, details }: Pick<ForecastPdfProps, "forecast" | "components" | "details">) {
  const rows = exportRows(forecast, components, details?.unitLabels, details?.rowDetails);
  // Shows cents everywhere when any row has them, so rows add up to the totals.
  return { rows, money: moneyColumn(rows.map((r) => r.total)) };
}

/** How many pages some content takes on its own. */
async function pageCount(content: ReactElement): Promise<number> {
  let pages = 0;
  await pdf(
    <Document>
      <Page size="LETTER" style={s.page}>
        {content}
        {/* Drawn on every page, so the last page number it sees is the count. */}
        <Text
          fixed
          style={{ position: "absolute" }}
          render={({ pageNumber }) => {
            pages = Math.max(pages, pageNumber);
            return null;
          }}
        />
      </Page>
    </Document>,
  ).toBlob();
  return pages;
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
  // The padding keeps long amounts in neighbouring columns from running together.
  num: { textAlign: "right", paddingLeft: 8 },
  noteCell: { flex: 1, paddingLeft: 10, fontSize: 8, color: muted },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: muted, flexDirection: "row", justifyContent: "space-between" },
});

// Wide enough for "250,000 sq ft", "$9,999,999.99" each and "$99,999,999.99" in total.
const cols = { year: 30, name: 136, qty: 72, each: 76, total: 84, condition: 56 };
// A longer table starts on a new page.
const MAX_ROWS_KEPT_TOGETHER = 12;
// A row stays on one page unless its name is long enough that it might not fit
// on one. The database allows 200 characters; the calculator has no limit.
const MAX_NAME_KEPT_TOGETHER = 500;
// Notes long enough to need most of a page (by characters or by lines, for a pasted list)
// may break across pages; shorter ones stay whole.
const MAX_NOTES_KEPT_TOGETHER = 1200;
const MAX_NOTE_LINES_KEPT_TOGETHER = 30;

export interface ForecastPdfProps {
  name: string;
  unitCount: number;
  forecast: Forecast;
  components: ForecastComponent[];
  details?: ExportDetails;
  generatedOn: string;
  /** Makes names safe to print; see printableText. */
  printable?: (text: string) => string;
  /**
   * Keeps the table on one page instead of starting it on a new one. Only set
   * when it fits on one; see forecastPdfBlob.
   */
  keepTableTogether?: boolean;
}

export default function ForecastPdf({
  name,
  unitCount,
  forecast,
  components,
  details = {},
  generatedOn,
  printable = (text) => text,
  keepTableTogether = false,
}: ForecastPdfProps) {
  const { rows, money } = tableData({ forecast, components, details });
  // Totals add up the rounded rows, so they match the table to the cent.
  const years = forecast.years.map((y) => ({ year: y.year, total: sumTotals(rows.filter((r) => r.year === y.year)) }));
  const maxYear = Math.max(1, ...years.map((y) => y.total));
  const leftOut = (details.leftOut ?? []).map((l) => ({ ...l, name: printable(l.name) }));
  // The saving-for list is its own column: cents on every line once one has them.
  const aheadMoney = moneyColumn(forecast.savingAhead.map((r) => r.cost));

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
          <Stat label="Monthly reserve" value={formatReserve(forecast.monthlyReserve)} />
          <Stat
            label="Per unit, per month"
            value={forecast.monthlyReservePerUnit === null ? "–" : formatReserve(forecast.monthlyReservePerUnit)}
          />
          <Stat label={`Needed in ${forecast.startYear}`} value={money(years[0].total)} />
          <Stat label="10-year total" value={money(sumTotals(rows))} />
        </View>
        {leftOut.length > 0 && <Text style={s.leftOut}>{leftOutSummary(leftOut)}</Text>}
        <Text style={s.note}>
          The monthly reserve is the smallest steady amount that has the cash ready for every replacement
          from {forecast.startYear + 1} on, looking 30 years ahead. {forecast.startYear} costs (overdue or due
          this year) are listed separately. All figures are in today&apos;s dollars, without inflation.
        </Text>

        <Text style={s.h2}>Replacement costs by year</Text>
        {years.map((y) => (
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
            {forecast.atRisk.map((a) => {
              const d = details.rowDetails?.get(a.componentId);
              const yearNote = installYearNote(a.installYearIsEstimate, d);
              return (
                <Text key={a.componentId} style={{ marginBottom: 2 }}>
                  {printable(a.name)}:{" "}
                  {a.status === "overdue"
                    ? `${-a.yearsRemaining} yr${a.yearsRemaining === -1 ? "" : "s"} past end of life`
                    : a.yearsRemaining === 0
                      ? "due this year"
                      : `due in ${a.yearsRemaining} yr${a.yearsRemaining === 1 ? "" : "s"}`}
                  {d?.condition ? `, ${CONDITION_TEXT[d.condition].toLowerCase()} condition` : ""}
                  {yearNote ? ` (${yearNote.toLowerCase()})` : ""}
                </Text>
              );
            })}
          </>
        )}

        <DueTable
          rows={rows}
          money={money}
          printable={printable}
          keepTogether={keepTableTogether}
          newPage={!keepTableTogether}
        />
        {rows.some((r) => r.notes.includes(ESTIMATED_NOTE)) && (
          <Text style={s.note}>
            {ESTIMATED_NOTE}: no install year was entered, so the building&apos;s year built is used.
          </Text>
        )}
        {rows.some((r) => r.notes.includes(GUESS_NOTE)) && (
          <Text style={s.note}>{GUESS_NOTE}: the year entered is the owner&apos;s best guess.</Text>
        )}

        {/* Later replacements the monthly reserve is already saving for, so it isn't a mystery. */}
        {forecast.savingAhead.length > 0 && (
          <>
            {/* Outside the rows' view, so minPresenceAhead can carry it to the next page with them. */}
            <Text style={s.h2} minPresenceAhead={40}>
              The monthly reserve is {forecast.years.some((y) => y.replacements.length > 0) ? "also " : ""}saving for
            </Text>
            <View>
              {forecast.savingAhead.map((r, i) => (
                <View
                  key={`${r.componentId}-${r.year}-${i}`}
                  style={s.tr}
                  wrap={r.name.length > MAX_NAME_KEPT_TOGETHER}
                >
                  <Text style={{ width: cols.year }}>{r.year}</Text>
                  <Text style={{ flex: 1 }}>{printable(r.name)}</Text>
                  <Text style={[s.num, { width: cols.total }]}>{aheadMoney(r.cost)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(details.conditionNotes ?? []).length > 0 && (
          <ConditionNotes items={details.conditionNotes ?? []} printable={printable} />
        )}

        <View style={s.footer} fixed>
          <Text>capexclock.com</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/**
 * The "What's due when" table. Its header row is fixed inside the table's view,
 * so it repeats on each page the table spans and nowhere else.
 */
function DueTable({
  rows,
  money,
  printable,
  keepTogether = false,
  newPage = false,
}: {
  rows: ExportRow[];
  money: (value: number) => string;
  printable: (text: string) => string;
  /** Keeps the whole table on one page. Only safe when it fits on one. */
  keepTogether?: boolean;
  /** Starts the table on a new page. */
  newPage?: boolean;
}) {
  return (
    <View style={s.table} break={newPage} wrap={!keepTogether}>
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
        <View key={`${r.name}-${r.year}-${i}`} style={s.tr} wrap={r.name.length > MAX_NAME_KEPT_TOGETHER}>
          <Text style={{ width: cols.year }}>{r.year}</Text>
          <Text style={{ width: cols.name }}>{printable(r.name)}</Text>
          <Text style={[s.num, { width: cols.qty }]}>{formatQuantity(r)}</Text>
          <Text style={[s.num, { width: cols.each }]}>{formatCostEach(r)}</Text>
          <Text style={[s.num, { width: cols.total }]}>{money(r.total)}</Text>
          <Text style={s.noteCell}>{r.notes.join("; ")}</Text>
        </View>
      ))}
      {rows.length === 0 && <Text style={s.note}>Nothing comes due in these 10 years.</Text>}
    </View>
  );
}

/** Each component's condition and the owner's notes, as the owner entered them. */
function ConditionNotes({ items, printable }: { items: ConditionNote[]; printable: (text: string) => string }) {
  return (
    <>
      {/* Outside the rows' view, so minPresenceAhead can carry it to the next page with
          the header row and the first item. */}
      <Text style={s.h2} minPresenceAhead={50}>
        Condition and notes
      </Text>
      <View style={s.table}>
        {/* Fixed inside the view, so it repeats on each page the list runs onto. */}
        <View style={s.tr} fixed>
          <Text style={[s.th, { width: cols.name }]}>Component</Text>
          <Text style={[s.th, { width: cols.condition }]}>Condition</Text>
          <Text style={[s.th, { flex: 1, paddingLeft: 10 }]}>Notes</Text>
        </View>
        {items.map((item, i) => (
          <View
            key={`${item.name}-${i}`}
            style={s.tr}
            wrap={
              item.name.length > MAX_NAME_KEPT_TOGETHER ||
              item.notes.length > MAX_NOTES_KEPT_TOGETHER ||
              item.notes.split("\n").length > MAX_NOTE_LINES_KEPT_TOGETHER
            }
          >
            <Text style={{ width: cols.name }}>{printable(item.name)}</Text>
            <Text style={{ width: cols.condition }}>{item.condition ? CONDITION_TEXT[item.condition] : ""}</Text>
            {/* Notes can hold a pasted link, too long to fit on one line without breaking. */}
            <Text style={{ flex: 1, paddingLeft: 10 }} hyphenationCallback={longWordParts}>
              {printable(item.notes)}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  // Smaller type for long amounts ("$1,234,567.89"), so they stay on one line.
  const fontSize = value.length <= 11 ? 14 : value.length <= 13 ? 12 : 10;
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { fontSize }]}>{value}</Text>
    </View>
  );
}
