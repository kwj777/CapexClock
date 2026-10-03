// The automatic emails' words and layout. Plain HTML with inline styles (mail apps
// ignore style sheets) and a plain-text copy of each. Every number comes from
// @/verticals/landlord; nothing here works one out.

import { formatMoney, formatReserve } from "@/components/calculator/format";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import type { BudgetSummary, ReminderItem } from "@/verticals/landlord";
import { EMAIL_KIND_TEXT, type EmailKind } from "./kinds";

export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** What every email needs to say who it's for and how to stop it. */
export interface EmailFooter {
  readonly kind: EmailKind;
  /** This email's unsubscribe page link. */
  readonly unsubscribeUrl: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_URL = `${SITE_URL}/app`;
const propertyUrl = (id: string) => `${SITE_URL}/app/properties/${encodeURIComponent(id)}`;

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TEXT = "color:#0f172a;font-size:15px;line-height:1.5";
const MUTED = "color:#475569;font-size:13px;line-height:1.5";
const LINK = "color:#b45309";
const CELL = "padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a";
const NUM = `${CELL};text-align:right;white-space:nowrap`;

function page(title: string, body: string, footer: EmailFooter): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;${FONT}">
<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f172a">CapexClock</p>
<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
${body}
</div>
<p style="margin:16px 0 0;${MUTED}">${footerHtml(footer)}</p>
</div>
</body></html>`;
}

function footerHtml({ kind, unsubscribeUrl }: EmailFooter): string {
  return (
    `You get the ${escapeHtml(EMAIL_KIND_TEXT[kind].label.toLowerCase())} email as a CapexClock founding member. ` +
    `Questions? Just reply, or email <a style="${LINK}" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. ` +
    `<a style="${LINK}" href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from this email</a> or ` +
    `<a style="${LINK}" href="${APP_URL}">change your email settings</a>.`
  );
}

function footerText({ kind, unsubscribeUrl }: EmailFooter): string {
  return [
    "--",
    `You get the ${EMAIL_KIND_TEXT[kind].label.toLowerCase()} email as a CapexClock founding member.`,
    `Questions? Just reply, or email ${CONTACT_EMAIL}.`,
    `Unsubscribe from this email: ${unsubscribeUrl}`,
    `Email settings: ${APP_URL}`,
  ].join("\n");
}

function groupByProperty<T extends { propertyId: string; propertyName: string }>(items: readonly T[]) {
  const groups = new Map<string, { name: string; items: T[] }>();
  for (const item of items) {
    const group = groups.get(item.propertyId);
    if (group) group.items.push(item);
    else groups.set(item.propertyId, { name: item.propertyName, items: [item] });
  }
  return [...groups.entries()].map(([id, g]) => ({ id, ...g }));
}

function reminderNote(item: ReminderItem): string {
  if (item.overdue) return "Past its end of life";
  if (item.replaceNow) return "You marked it Replace now";
  return "Reaches its end of life this year";
}

/** The replacement reminder: what comes due this year (or is overdue) and hasn't been mentioned yet. */
export function reminderEmail(items: readonly ReminderItem[], year: number, footer: EmailFooter): EmailContent {
  const total = items.reduce((sum, i) => sum + i.cost, 0);
  const n = items.length;
  const subject =
    n === 1 ? `${items[0].name} is due for replacement in ${year}` : `${n} replacements are due in ${year}`;
  const intro = `${n === 1 ? "This comes" : "These come"} due in ${year}, ${formatMoney(total)} in all at today's prices.`;
  const groups = groupByProperty(items);

  const html = page(
    subject,
    `<p style="margin:0 0 16px;${TEXT}">${escapeHtml(intro)}</p>
${groups
  .map(
    (g) => `<p style="margin:16px 0 4px;font-size:15px;font-weight:600;color:#0f172a"><a style="${LINK}" href="${propertyUrl(g.id)}">${escapeHtml(g.name)}</a></p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${g.items
  .map(
    (i) =>
      `<tr><td style="${CELL}">${escapeHtml(i.name)}<br><span style="${MUTED}">${escapeHtml(reminderNote(i))}</span></td><td style="${NUM}">${formatMoney(i.cost)}</td></tr>`,
  )
  .join("\n")}
</table>`,
  )
  .join("\n")}
<p style="margin:16px 0 0;${TEXT}">Already replaced something? Update its install year in <a style="${LINK}" href="${APP_URL}">My properties</a> and it drops off.</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    ...groups.flatMap((g) => [
      "",
      `${g.name} (${propertyUrl(g.id)})`,
      ...g.items.map((i) => `- ${i.name}: ${formatMoney(i.cost)}. ${reminderNote(i)}.`),
    ]),
    "",
    `Already replaced something? Update its install year in My properties (${APP_URL}) and it drops off.`,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}

/** The yearly budget summary, sent in November for the year ahead. */
export function budgetSummaryEmail(summary: BudgetSummary, footer: EmailFooter): EmailContent {
  const { budgetYear: year, totals } = summary;
  const subject = `Your ${year} replacement budget: ${formatMoney(totals.budgetYearTotal)}`;
  const intro =
    `In ${year}, plan on ${formatMoney(totals.budgetYearTotal)} for replacements across ` +
    `${summary.properties.length === 1 ? "your property" : `your ${summary.properties.length} properties`}, ` +
    `and ${formatMoney(totals.tenYearTotal)} over the next 10 years. To never run short, set aside ` +
    `${formatReserve(totals.monthlyReserve)} a month.`;

  const propertyHtml = summary.properties
    .map((p) => {
      const rows: [string, string][] = [
        [`Replacements in ${year}`, formatMoney(p.budgetYearTotal)],
        ["Next 10 years", formatMoney(p.tenYearTotal)],
        ["Monthly reserve", formatReserve(p.monthlyReserve)],
      ];
      if (p.monthlyReservePerUnit !== null) rows.push(["Per unit, per month", formatReserve(p.monthlyReservePerUnit)]);
      rows.push(["Items at risk", String(p.atRiskCount)]);
      const items = p.budgetYearItems.length
        ? `<p style="margin:8px 0 0;${MUTED}">Due in ${year}: ${p.budgetYearItems
            .map((i) => `${escapeHtml(i.name)} ${formatMoney(i.cost)}${i.overdue ? " (overdue)" : ""}`)
            .join(", ")}</p>`
        : "";
      const left = p.excluded
        ? `<p style="margin:4px 0 0;${MUTED}">${p.excluded} component${p.excluded === 1 ? " is" : "s are"} left out because ${p.excluded === 1 ? "it has" : "they have"} no cost or install year.</p>`
        : "";
      return `<p style="margin:20px 0 4px;font-size:15px;font-weight:600;color:#0f172a"><a style="${LINK}" href="${propertyUrl(p.propertyId)}">${escapeHtml(p.name)}</a></p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${rows.map(([label, value]) => `<tr><td style="${CELL}">${label}</td><td style="${NUM}">${value}</td></tr>`).join("\n")}
</table>${items}${left}`;
    })
    .join("\n");

  const html = page(
    subject,
    `<p style="margin:0 0 8px;${TEXT}">${escapeHtml(intro)}</p>
${propertyHtml}
<p style="margin:20px 0 0;${MUTED}">Costs are in today's dollars, from the components you saved. Anything past its end of life counts in ${year}. Update conditions and install years in <a style="${LINK}" href="${APP_URL}">My properties</a> to keep these numbers right.</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    ...summary.properties.flatMap((p) => [
      "",
      `${p.name} (${propertyUrl(p.propertyId)})`,
      `- Replacements in ${year}: ${formatMoney(p.budgetYearTotal)}`,
      `- Next 10 years: ${formatMoney(p.tenYearTotal)}`,
      `- Monthly reserve: ${formatReserve(p.monthlyReserve)}`,
      ...(p.monthlyReservePerUnit !== null ? [`- Per unit, per month: ${formatReserve(p.monthlyReservePerUnit)}`] : []),
      `- Items at risk: ${p.atRiskCount}`,
      ...(p.budgetYearItems.length
        ? [`- Due in ${year}: ${p.budgetYearItems.map((i) => `${i.name} ${formatMoney(i.cost)}${i.overdue ? " (overdue)" : ""}`).join(", ")}`]
        : []),
      ...(p.excluded ? [`- ${p.excluded} left out (no cost or install year)`] : []),
    ]),
    "",
    `Costs are in today's dollars, from the components you saved. Anything past its end of life counts in ${year}.`,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}

/** One property's line in the condition report email. */
export interface ReportSummaryLine {
  readonly propertyId: string;
  readonly name: string;
  readonly atRisk: number;
  readonly unrated: number;
  readonly excluded: number;
}

/** The yearly condition report email; the PDFs go with it as attachments. */
export function conditionReportEmail(lines: readonly ReportSummaryLine[], year: number, footer: EmailFooter): EmailContent {
  const n = lines.length;
  const subject = `Your ${year} condition report${n === 1 ? "" : "s"}`;
  const intro =
    n === 1
      ? `Attached is the ${year} condition report for ${lines[0].name}: each component's age, remaining life and condition, what's at risk, a 10-year forecast and the monthly reserve.`
      : `Attached are the ${year} condition reports for your ${n} properties: each component's age, remaining life and condition, what's at risk, a 10-year forecast and the monthly reserve.`;
  const detail = (l: ReportSummaryLine) =>
    [
      `${l.atRisk} at risk`,
      ...(l.unrated ? [`${l.unrated} without a condition rating`] : []),
      ...(l.excluded ? [`${l.excluded} left out (no cost or install year)`] : []),
    ].join(", ");
  const nudge =
    "The reports use the conditions and install years you saved. If something's changed, update it in My properties, and the next report (and your forecast) will reflect it.";
  const label = "A planning document made from the information you supplied, not an inspection.";

  const html = page(
    subject,
    `<p style="margin:0 0 12px;${TEXT}">${escapeHtml(intro)}</p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${lines
  .map(
    (l) =>
      `<tr><td style="${CELL}"><a style="${LINK}" href="${propertyUrl(l.propertyId)}">${escapeHtml(l.name)}</a><br><span style="${MUTED}">${escapeHtml(detail(l))}</span></td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:16px 0 0;${TEXT}">${escapeHtml(nudge).replace("My properties", `<a style="${LINK}" href="${APP_URL}">My properties</a>`)}</p>
<p style="margin:8px 0 0;${MUTED}">${escapeHtml(label)}</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    "",
    ...lines.map((l) => `- ${l.name}: ${detail(l)} (${propertyUrl(l.propertyId)})`),
    "",
    `${nudge} ${APP_URL}`,
    label,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}
