import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney, formatReserve, safetyBufferSentence } from "@/components/calculator/format";
import { formatQuantity, moneyColumn } from "@/lib/export/format";
import { barPercent, exportRows, pdfYearFigures } from "@/lib/export/rows";
import { REPORT_LABEL } from "@/lib/paid-ideas";
import { CONTACT_EMAIL } from "@/lib/site";
import {
  ageText,
  CONDITION_TEXT,
  conditionCounts,
  countNoun,
  LANDLORD_LABELS,
  leftOutLife,
  leftOutReasonText,
  remainingLifeText,
  statusText,
  type Component,
  type LandlordForecast,
  type LeftOutComponent,
  type ReportRow,
} from "@/verticals/landlord";

// A condition report as a PDF: the sample (scripts/sample-report.tsx) and members'
// yearly reports (src/lib/owner-emails/condition-report.tsx). Whoever renders it
// registers the font first. The $29 one-off reports are still made by hand.

/** Registered by whoever renders the report, from public/fonts. */
export const REPORT_FONT = "DejaVu Sans";

const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const amber = "#f59e0b";
const amberWash = "#fffbeb";
const warning = "#92400e";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9.5, color: ink, fontFamily: REPORT_FONT },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 9, color: muted, letterSpacing: 0.5 },
  sample: { fontSize: 8, fontWeight: "bold", color: warning, borderWidth: 1, borderColor: amber, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  title: { fontSize: 22, fontWeight: "bold", marginTop: 14 },
  subtitle: { fontSize: 10, color: muted, marginTop: 4 },
  label: { marginTop: 16, padding: 12, backgroundColor: amberWash, borderLeftWidth: 3, borderLeftColor: amber },
  labelText: { fontSize: 10.5, fontWeight: "bold", lineHeight: 1.35 },
  labelNote: { fontSize: 8.5, color: muted, marginTop: 4, lineHeight: 1.35 },
  h2: { fontSize: 13, fontWeight: "bold", marginTop: 22, marginBottom: 8 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 6, padding: 10 },
  statLabel: { fontSize: 8, color: muted },
  statValue: { fontSize: 15, fontWeight: "bold", marginTop: 3 },
  facts: { borderTopWidth: 1, borderTopColor: line },
  fact: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 5 },
  factName: { width: 170, color: muted },
  factValue: { flex: 1 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.35 },
  bulletDot: { width: 12, color: amber, fontWeight: "bold" },
  note: { fontSize: 8.5, color: muted, marginTop: 6, lineHeight: 1.4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 5 },
  th: { fontSize: 7.5, color: muted, fontWeight: "bold" },
  num: { textAlign: "right", paddingLeft: 6 },
  rowName: { fontWeight: "bold" },
  rowSub: { fontSize: 7.5, color: muted, marginTop: 1 },
  risk: { fontSize: 7.5, color: warning, fontWeight: "bold", marginTop: 1 },
  rowNotes: { fontSize: 8, color: muted, marginTop: 3, paddingLeft: 8, lineHeight: 1.35 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barYear: { width: 34, fontSize: 9, color: muted },
  barTrack: { flex: 1, height: 10 },
  bar: { height: 10, backgroundColor: amber, borderRadius: 2 },
  barValue: { width: 70, textAlign: "right", fontSize: 9 },
  para: { marginBottom: 6, fontSize: 9.5, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: muted, flexDirection: "row", justifyContent: "space-between", gap: 12 },
});

// Component table columns, in points (the page has 524 between margins).
const cols = { name: 124, qty: 68, installed: 46, age: 56, life: 38, remaining: 62, condition: 58, cost: 72 };

export interface ConditionReportProps {
  propertyName: string;
  unitCount: number;
  /** Null when the owner didn't enter one; the subtitle then leaves it out. */
  yearBuilt: number | null;
  rows: ReportRow[];
  forecast: LandlordForecast;
  components: readonly Component[];
  /** Components the report leaves out (no cost or no install year): named, never counted. */
  leftOut?: readonly LeftOutComponent[];
  /** "October 1, 2026" */
  preparedOn: string;
  /** "October 2026": when the owner's information is from. */
  informationAsOf: string;
  /** Marks every page as a sample, with a line saying what's made up. */
  sampleNote?: string;
}

export default function ConditionReportPdf({
  propertyName,
  unitCount,
  yearBuilt,
  rows,
  forecast,
  components,
  leftOut = [],
  preparedOn,
  informationAsOf,
  sampleNote,
}: ConditionReportProps) {
  const atRisk = rows.filter((r) => r.status !== "ok");
  // Left out of every total, but an overdue one still belongs in the at-risk list.
  const leftAtRisk = leftOut.flatMap((c) => {
    const life = leftOutLife(c, forecast.startYear);
    return life && life.status !== "ok" ? [{ ...c, ...life, endOfLifeYear: c.endOfLifeYear! }] : [];
  });
  const riskList = [
    ...atRisk.map((r) => ({ kind: "row" as const, r, remainingLife: r.remainingLife, name: r.name })),
    ...leftAtRisk.map((c) => ({ kind: "left" as const, c, remainingLife: c.remainingLife, name: c.name })),
  ].sort((a, b) => a.remainingLife - b.remainingLife || a.name.localeCompare(b.name));
  const listed = rows.length + leftOut.length;
  const estimated = rows.filter((r) => r.installYearIsEstimate);
  const due = exportRows(forecast, components, new Map(rows.map((r) => [r.id, r.unitLabel])));
  const money = moneyColumn(due.map((r) => r.total));
  const { years, maxYear, neededNow, horizonTotal } = pdfYearFigures(forecast, due);
  const ratings = conditionCounts(rows);
  const units = `${unitCount.toLocaleString("en-US")} ${countNoun(LANDLORD_LABELS.divisor, unitCount)}`;

  const header = (
    <View style={s.topRow} fixed>
      <Text style={s.brand}>CAPEXCLOCK · CONDITION REPORT · {propertyName}</Text>
      {sampleNote && <Text style={s.sample}>SAMPLE</Text>}
    </View>
  );
  const footer = (
    <View style={s.footer} fixed>
      <Text>{REPORT_LABEL}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document
      title={`${propertyName} condition report`}
      author="CapexClock"
      subject={REPORT_LABEL}
      creator="CapexClock"
      producer="CapexClock"
    >
      <Page size="LETTER" style={s.page}>
        {header}
        <Text style={s.title}>{propertyName}</Text>
        <Text style={s.subtitle}>
          {yearBuilt === null ? (
            <>
              {units} · prepared {preparedOn}
            </>
          ) : (
            <>
              {units} · built {yearBuilt} · prepared {preparedOn}
            </>
          )}
        </Text>

        <View style={s.label}>
          <Text style={s.labelText}>{REPORT_LABEL}</Text>
          {sampleNote && <Text style={s.labelNote}>{sampleNote}</Text>}
        </View>

        <Text style={s.h2}>Summary</Text>
        <View style={s.stats}>
          <Stat label="Monthly reserve" value={formatReserve(forecast.monthlyReserve)} />
          <Stat
            label="Per unit, per month"
            value={forecast.monthlyReservePerUnit === null ? "–" : formatReserve(forecast.monthlyReservePerUnit)}
          />
          <Stat label={`Needed in ${forecast.startYear}`} value={money(neededNow)} />
          <Stat label="10-year total" value={money(horizonTotal)} />
        </View>
        <Text style={s.note}>
          The monthly reserve is the smallest steady amount that has the cash ready for every replacement from{" "}
          {forecast.reserveFromYear} on, looking 30 years ahead.{" "}
          {safetyBufferSentence(forecast) && `${safetyBufferSentence(forecast)} `}
          {forecast.startYear} costs (past end of life or due this
          year) are shown separately as needed now. All costs are in today&apos;s dollars, without inflation.
        </Text>

        <Text style={s.h2}>Property</Text>
        <View style={s.facts}>
          <Fact name="Units" value={units} />
          <Fact name="Year built" value={yearBuilt === null ? "Not entered" : String(yearBuilt)} />
          <Fact
            name="Components listed"
            value={leftOut.length > 0 ? `${rows.length} of ${listed}` : String(rows.length)}
          />
          {leftOut.length > 0 && (
            <Fact
              name="Not in this report"
              value={`${leftOut.map((c) => `${c.name} (${leftOutReasonText(c.missing)})`).join(", ")}. Not counted in any figure here.`}
            />
          )}
          <Fact
            name="Condition, rated by the owner"
            value={
              ratings.length > 0
                ? ratings.map((r) => `${r.count} ${CONDITION_TEXT[r.condition].toLowerCase()}`).join(", ")
                : "Not rated"
            }
          />
          <Fact name="At risk" value={`${riskList.length} of ${listed} (past end of life or due within 2 years)`} />
          <Fact name="Information supplied by" value={`The owner, ${informationAsOf}`} />
        </View>

        <Text style={s.h2}>At risk</Text>
        {riskList.length === 0 ? (
          <Text>Nothing is past its end of life or due within 2 years.</Text>
        ) : (
          riskList.map((item) => (
            <View key={item.kind === "row" ? item.r.id : item.c.componentId} style={s.bullet} wrap={false}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>
                <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
                {": "}
                {lifeText(item.remainingLife, item.kind === "row" ? item.r.endOfLifeYear : item.c.endOfLifeYear)}
                {item.kind === "row" ? (
                  <>
                    {item.r.condition ? `, condition ${CONDITION_TEXT[item.r.condition].toLowerCase()}` : ""}
                    {item.r.installYearIsEstimate ? ". Install year estimated" : ""}. Replacement{" "}
                    {formatMoney(item.r.replacementCost)}.
                  </>
                ) : item.c.missing === "cost" ? (
                  ". Replacement cost not entered."
                ) : (
                  `. Not in this report: ${leftOutReasonText(item.c.missing)}.`
                )}
              </Text>
            </View>
          ))
        )}
        {footer}
      </Page>

      <Page size="LETTER" style={s.page}>
        {header}
        <Text style={[s.h2, { marginTop: 14 }]}>Components</Text>
        <View style={s.tr} fixed>
          <Text style={[s.th, { width: cols.name }]}>Component</Text>
          <Text style={[s.th, s.num, { width: cols.qty }]}>Qty</Text>
          <Text style={[s.th, s.num, { width: cols.installed }]}>Installed</Text>
          <Text style={[s.th, s.num, { width: cols.age }]}>Age</Text>
          <Text style={[s.th, s.num, { width: cols.life }]}>Life</Text>
          <Text style={[s.th, s.num, { width: cols.remaining }]}>Remaining</Text>
          <Text style={[s.th, { width: cols.condition, paddingLeft: 8 }]}>Condition</Text>
          <Text style={[s.th, s.num, { width: cols.cost }]}>Replacement</Text>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={s.tr} wrap={false}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row" }}>
                <View style={{ width: cols.name }}>
                  <Text style={s.rowName}>{r.name}</Text>
                  <Text style={s.rowSub}>{r.category}</Text>
                  {r.status !== "ok" && <Text style={s.risk}>{statusText(r.status)}</Text>}
                </View>
                <Text style={[s.num, { width: cols.qty }]}>
                  {formatQuantity({ quantity: r.quantity, unit: r.unitLabel === "per_sq_ft" ? "sq ft" : "each" })}
                </Text>
                <Text style={[s.num, { width: cols.installed }]}>
                  {r.installYear}
                  {r.installYearIsEstimate ? "*" : ""}
                </Text>
                <Text style={[s.num, { width: cols.age }]}>{ageText(r)}</Text>
                <Text style={[s.num, { width: cols.life }]}>{r.usefulLife} yrs</Text>
                <Text style={[s.num, { width: cols.remaining }, r.status !== "ok" ? { color: warning } : {}]}>
                  {remainingLifeText(r.remainingLife, true)}
                </Text>
                <Text style={{ width: cols.condition, paddingLeft: 8 }}>
                  {r.condition ? CONDITION_TEXT[r.condition] : "Not rated"}
                </Text>
                <Text style={[s.num, { width: cols.cost }]}>{formatMoney(r.replacementCost)}</Text>
              </View>
              {r.notes && <Text style={s.rowNotes}>Owner&apos;s notes: {r.notes}</Text>}
            </View>
          </View>
        ))}
        <Text style={s.note}>
          Age and remaining life are counted from the install year to {forecast.startYear}. Life is the useful life the
          owner chose. Remaining life is the install year plus the useful life, minus {forecast.startYear}. At risk
          means past end of life or due within 2 years. Replacement is the quantity times the owner&apos;s cost each,
          in today&apos;s dollars.
          {estimated.length > 0
            ? ` * No install year was recorded for ${estimated.map((r) => r.name.toLowerCase()).join(", ")}, so the year built is used, and the age is an estimate.`
            : ""}
        </Text>
        {footer}
      </Page>

      <Page size="LETTER" style={s.page}>
        {header}
        <Text style={[s.h2, { marginTop: 14 }]}>
          10-year forecast, {forecast.startYear}–{forecast.endYear}
        </Text>
        {years.map((y) => (
          <View key={y.year} style={s.barRow}>
            <Text style={s.barYear}>{y.year}</Text>
            <View style={s.barTrack}>
              {y.total > 0 && <View style={[s.bar, { width: `${barPercent(y.total, maxYear)}%` }]} />}
            </View>
            <Text style={s.barValue}>{money(y.total)}</Text>
          </View>
        ))}

        <Text style={s.h2}>What&apos;s due when</Text>
        <View style={s.tr} fixed>
          <Text style={[s.th, { width: 40 }]}>Year</Text>
          <Text style={[s.th, { flex: 1 }]}>Component</Text>
          <Text style={[s.th, { width: 120 }]}>Note</Text>
          <Text style={[s.th, s.num, { width: 80 }]}>Cost</Text>
        </View>
        {due.map((r, i) => (
          <View key={`${r.name}-${r.year}-${i}`} style={[s.tr, { paddingVertical: 3 }]} wrap={false}>
            <Text style={{ width: 40 }}>{r.year}</Text>
            <Text style={{ flex: 1 }}>{r.name}</Text>
            <Text style={{ width: 120, color: muted, fontSize: 8 }}>{r.notes.join("; ")}</Text>
            <Text style={[s.num, { width: 80 }]}>{money(r.total)}</Text>
          </View>
        ))}
        {forecast.savingAhead.length > 0 && (
          <Text style={s.note}>
            The monthly reserve also saves for{" "}
            {forecast.savingAhead.map((r) => `${r.name.toLowerCase()} in ${r.year} (${formatMoney(r.cost)})`).join(", ")}.
          </Text>
        )}

        <Text style={s.h2} minPresenceAhead={80}>
          About this report
        </Text>
        <Text style={s.para}>
          {REPORT_LABEL} We didn&apos;t visit or inspect the building. The install years, quantities, useful lives,
          costs, conditions and notes are the owner&apos;s, as of {informationAsOf}, and the report is only as accurate
          as they are.
        </Text>
        <Text style={s.para}>
          The owner may share this report with anyone, such as a lender or a buyer. No one but the owner may rely on it,
          and buyers and lenders should get their own inspection.
        </Text>
        <Text style={s.para}>
          Anything to do with safety, such as gas, electrical, structure or water damage, needs a licensed professional.
          This report never says a system is safe.
        </Text>
        <Text style={s.para}>Questions: {CONTACT_EMAIL} · capexclock.com</Text>
        {footer}
      </Page>
    </Document>
  );
}

/** "4 years past its end of life (2023)", "due this year (2026)" or "due in 2 years (2028)". */
function lifeText(remainingLife: number, endOfLifeYear: number): string {
  if (remainingLife < 0) return `${remainingLifeText(remainingLife)} its end of life (${endOfLifeYear})`;
  return remainingLife === 0
    ? `due this year (${endOfLifeYear})`
    : `due in ${remainingLifeText(remainingLife)} (${endOfLifeYear})`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <View style={s.fact} wrap={false}>
      <Text style={s.factName}>{name}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}
