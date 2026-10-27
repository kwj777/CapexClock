// The automatic emails' words and layout. Plain HTML with inline styles (mail apps
// ignore style sheets) and a plain-text copy of each. Every number comes from
// @/verticals/landlord; nothing here works one out.

import { formatMoney, formatReserve } from "@/components/calculator/format";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import {
  leftOutReasonText,
  type BudgetProperty,
  type BudgetSummary,
  type LeftOutComponent,
  type ReminderItem,
} from "@/verticals/landlord";
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
// EmailSettings' id; the sign-in page carries it through to /app.
const SETTINGS_URL = `${APP_URL}#email-settings`;
const propertyUrl = (id: string) => `${SITE_URL}/app/properties/${encodeURIComponent(id)}`;

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TEXT = "color:#0f172a;font-size:15px;line-height:1.5";
const MUTED = "color:#475569;font-size:13px;line-height:1.5";
const LINK = "color:#b45309";
const CELL = "padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a";
const NUM = `${CELL};text-align:right;white-space:nowrap`;
// A cost table lists this many rows, then "+N more".
const MAX_ROWS = 8;

/** A cost, flagging $0: it's allowed (a warranty, say) but often a slip. */
function costText(cost: number): string {
  return cost === 0 ? `${formatMoney(0)} (check the cost)` : formatMoney(cost);
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "Windows (no replacement cost entered, past its end of life since 2023)", as of `year`. */
function leftOutLabel(c: LeftOutComponent, year: number): string {
  const when =
    c.endOfLifeYear === null
      ? ""
      : c.endOfLifeYear < year
        ? `, past its end of life since ${c.endOfLifeYear}`
        : c.endOfLifeYear === year
          ? `, due in ${year}`
          : "";
  return `${c.name} (${leftOutReasonText(c.missing)}${when})`;
}

/** "Left out until you add a cost", or "...fill them in" when some miss something else. */
function leftOutLead(items: readonly LeftOutComponent[]): string {
  return items.every((c) => c.missing === "cost") ? "Left out until you add a cost" : "Left out until you fill them in";
}

/** Due by the end of `year`: what a left-out row would have counted toward. */
const dueBy = (c: LeftOutComponent, year: number) => c.endOfLifeYear !== null && c.endOfLifeYear <= year;

function page(title: string, body: string, footer: EmailFooter): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="width:100%;border-collapse:collapse;background:#f8fafc"><tr><td>
<div style="max-width:600px;margin:0 auto;padding:24px 16px;${FONT}">
<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0f172a">CapexClock</p>
<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
${body}
</div>
<p style="margin:16px 0 0;${MUTED}">${footerHtml(footer)}</p>
</div>
</td></tr></table>
</body></html>`;
}

function footerHtml({ kind, unsubscribeUrl }: EmailFooter): string {
  return (
    `You get the ${escapeHtml(EMAIL_KIND_TEXT[kind].label.toLowerCase())} email as a CapexClock founding member. ` +
    `Questions? Just reply, or email <a style="${LINK}" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. ` +
    `<a style="${LINK}" href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from this email</a> or ` +
    `<a style="${LINK}" href="${SETTINGS_URL}">change your email settings</a>.`
  );
}

function footerText({ kind, unsubscribeUrl }: EmailFooter): string {
  return [
    "--",
    `You get the ${EMAIL_KIND_TEXT[kind].label.toLowerCase()} email as a CapexClock founding member.`,
    `Questions? Just reply, or email ${CONTACT_EMAIL}.`,
    `Unsubscribe from this email: ${unsubscribeUrl}`,
    `Email settings: ${SETTINGS_URL}`,
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

/** "Maple Court: 2 past end of life, 2 more due in 2026"; "Oak Row: Water heater is past its end of life". */
function reminderSubject(items: readonly ReminderItem[], year: number, properties: readonly { name: string }[]): string {
  const n = items.length;
  const overdue = items.filter((i) => i.overdue).length;
  const what =
    n === 1
      ? `${items[0].name} ${items[0].overdue ? "is past its end of life" : `is due for replacement in ${year}`}`
      : overdue === 0
        ? `${n} replacements due in ${year}`
        : overdue === n
          ? `${n} items past their end of life`
          : `${overdue} past end of life, ${n - overdue} more due in ${year}`;
  return properties.length === 1 ? `${properties[0].name}: ${what}` : `${what} across ${properties.length} properties`;
}

/** The replacement reminder: what comes due this year (or is overdue) and hasn't been mentioned yet. */
export function reminderEmail(items: readonly ReminderItem[], year: number, footer: EmailFooter): EmailContent {
  const n = items.length;
  const overdue = items.filter((i) => i.overdue).length;
  const priced = items.filter((i): i is ReminderItem & { cost: number } => i.cost !== null);
  const unpriced = n - priced.length;
  const total = priced.reduce((sum, i) => sum + i.cost, 0);
  const groups = groupByProperty(items);
  const subject = reminderSubject(items, year, groups);
  const lead =
    overdue === 0
      ? `${plural(n, "This comes", "These come")} due in ${year}`
      : overdue === n
        ? `${plural(n, "This is past its", "These are past their")} end of life and still waiting to be replaced`
        : `${overdue} ${plural(overdue, "is past its", "are past their")} end of life and still waiting to be replaced, ` +
          `and ${n - overdue} more ${plural(n - overdue, "comes", "come")} due in ${year}`;
  const intro =
    priced.length === 0
      ? `${lead}. Add ${plural(n, "its replacement cost", "their replacement costs")} to see what to budget.`
      : `${lead}: ${formatMoney(total)} in all at today's prices` +
        `${unpriced ? `, not counting ${unpriced} without a cost yet` : ""}.`;
  // One property: the action goes straight to it.
  const actionUrl = groups.length === 1 ? propertyUrl(groups[0].id) : APP_URL;
  const actionName = groups.length === 1 ? groups[0].name : "My properties";
  const missing = (g: (typeof groups)[number]) =>
    g.items.filter((i) => i.cost === null).map((i) => `${i.name} (${reminderNote(i).toLowerCase()})`);

  const html = page(
    subject,
    `<p style="margin:0 0 16px;${TEXT}">${escapeHtml(intro)}</p>
${groups
  .map((g) => {
    const rows = g.items.filter((i) => i.cost !== null);
    const noCost = missing(g);
    return `<p style="margin:16px 0 4px;font-size:15px;font-weight:600;color:#0f172a"><a style="${LINK}" href="${propertyUrl(g.id)}">${escapeHtml(g.name)}</a></p>
${
  rows.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse">
${rows
  .map(
    (i) =>
      `<tr><td style="${CELL}">${escapeHtml(i.name)}<br><span style="${MUTED}">${escapeHtml(reminderNote(i))}</span></td><td style="${NUM}">${escapeHtml(costText(i.cost!))}</td></tr>`,
  )
  .join("\n")}
</table>`
    : ""
}${
  noCost.length
    ? `<p style="margin:8px 0 0;${TEXT}">Due but missing a cost: ${escapeHtml(noCost.join(", "))}. <a style="${LINK}" href="${propertyUrl(g.id)}">Add ${plural(noCost.length, "its cost", "their costs")}</a>.</p>`
    : ""
}`;
  })
  .join("\n")}
<p style="margin:16px 0 0;${TEXT}">Already replaced something? Update its install year in <a style="${LINK}" href="${actionUrl}">${escapeHtml(actionName)}</a> and it drops off.</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    ...groups.flatMap((g) => {
      const noCost = missing(g);
      return [
        "",
        `${g.name} (${propertyUrl(g.id)})`,
        ...g.items.filter((i) => i.cost !== null).map((i) => `- ${i.name}: ${costText(i.cost!)}. ${reminderNote(i)}.`),
        ...(noCost.length ? [`- Due but missing a cost: ${noCost.join(", ")}.`] : []),
      ];
    }),
    "",
    `Already replaced something? Update its install year in ${actionName} (${actionUrl}) and it drops off.`,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}

/** The budget email's opening paragraph. */
function budgetIntro(summary: BudgetSummary): string {
  const { budgetYear: year, totals, properties } = summary;
  const across = properties.length === 1 ? "your property" : `your ${properties.length} properties`;
  const leftOut = properties.flatMap((p) => p.leftOut);
  const leftDue = leftOut.filter((c) => dueBy(c, year)).length;
  const reserve = formatReserve(totals.monthlyReserve);
  const withCost = leftOut.length ? " with a cost" : "";

  // Nothing could be counted: say what's missing rather than $0.
  if (leftOut.length && properties.every((p) => p.componentCount === p.excluded)) {
    return (
      `None of the ${leftOut.length} ${plural(leftOut.length, "component", "components")} you saved across ${across} can be counted yet: ` +
      `each needs a replacement cost and an install year. ` +
      (leftDue ? `${leftDue} of them ${plural(leftDue, "is", "are")} past ${plural(leftDue, "its", "their")} end of life or due in ${year}. ` : "") +
      `Add what's missing and this budget fills in.`
    );
  }
  if (properties.every((p) => p.componentCount === 0)) {
    return `You haven't saved any components yet, so there's nothing to budget. Add them in My properties and next year's email will have your numbers.`;
  }

  let intro: string;
  if (properties.some((p) => p.budgetYearItems.length > 0)) {
    intro =
      `In ${year}, plan on ${formatMoney(totals.budgetYearTotal)} for replacements across ${across}, ` +
      `and ${formatMoney(totals.tenYearTotal)} over the next 10 years. Pay the ${year} items from savings you already have, ` +
      `since there's no time to save for them. To cover replacements from ${year + 1} on, set aside ${reserve} a month.`;
  } else if (totals.tenYearTotal > 0) {
    intro =
      `Nothing${withCost} across ${across} is due for replacement in ${year}. Over the next 10 years, plan on ` +
      `${formatMoney(totals.tenYearTotal)}. To have the cash ready for each one, set aside ${reserve} a month.`;
  } else if (totals.monthlyReserve > 0) {
    const ahead = properties.flatMap((p) => p.savingAhead);
    intro =
      `Nothing${withCost} across ${across} is due in the next 10 years. Setting aside ${reserve} a month now builds up ` +
      `the cash for replacements further out` +
      (ahead.length > 0 && ahead.length <= 3 ? `: ${ahead.map((r) => `${r.name} in ${r.year}`).join(", ")}.` : ".");
  } else {
    intro = `Nothing${withCost} across ${across} is due for replacement in the next 30 years, so there's nothing to set aside yet.`;
  }
  if (leftOut.length) {
    intro +=
      ` ${leftOut.length} ${plural(leftOut.length, "component is", "components are")} left out until you fill ${plural(leftOut.length, "it", "them")} in` +
      (leftDue ? `, ${leftDue} of them past ${plural(leftDue, "its", "their")} end of life or due in ${year}` : "") +
      `. See below.`;
  }
  return intro;
}

/** One property's figures, or nothing when none of its components could be counted. */
function budgetRows(p: BudgetProperty, year: number): [string, string][] {
  if (p.componentCount === p.excluded) return [];
  const rows: [string, string][] = [
    [`Replacements in ${year}`, formatMoney(p.budgetYearTotal)],
    ["Next 10 years", formatMoney(p.tenYearTotal)],
    [p.tenYearTotal === 0 && p.monthlyReserve > 0 ? "Monthly reserve (saving ahead)" : "Monthly reserve", formatReserve(p.monthlyReserve)],
  ];
  if (p.monthlyReservePerUnit !== null) rows.push(["Per unit, per month", formatReserve(p.monthlyReservePerUnit)]);
  rows.push(["At risk (overdue or due within 2 years)", String(p.atRiskCount)]);
  return rows;
}

const savingAheadText = (p: BudgetProperty) =>
  `The monthly reserve also saves for ${p.savingAhead.map((r) => `${r.name} in ${r.year} (${formatMoney(r.cost)})`).join(", ")}.`;

/** The yearly budget summary, sent in November for the year ahead. */
export function budgetSummaryEmail(summary: BudgetSummary, footer: EmailFooter): EmailContent {
  const { budgetYear: year, totals } = summary;
  const leftOut = summary.properties.flatMap((p) => p.leftOut);
  const leftDue = leftOut.filter((c) => dueBy(c, year)).length;
  const anyDue = summary.properties.some((p) => p.budgetYearItems.length > 0);
  // Never "Nothing to replace" while something is left out.
  const subject = anyDue
    ? `Your ${year} replacement budget: ${formatMoney(totals.budgetYearTotal)}` +
      (leftDue ? ` (${leftDue} more ${plural(leftDue, "needs", "need")} a cost)` : "")
    : leftOut.length
      ? `Add costs to finish your ${year} budget`
      : `Nothing to replace in ${year}`;
  const intro = budgetIntro(summary);
  const single = summary.properties.length === 1 ? summary.properties[0] : null;
  const updateUrl = single ? propertyUrl(single.propertyId) : APP_URL;
  const updateName = single ? single.name : "My properties";
  const counted = summary.properties.some((p) => p.componentCount > p.excluded);
  const reserveNote = counted
    ? ` The monthly reserve is the smallest steady amount that has the cash ready for every replacement from ${year + 1} on, looking 30 years ahead.`
    : "";

  const propertyHtml = summary.properties
    .map((p) => {
      const rows = budgetRows(p, year);
      const table = rows.length
        ? `<table role="presentation" style="width:100%;border-collapse:collapse">
${rows.map(([label, value]) => `<tr><td style="${CELL}">${label}</td><td style="${NUM}">${value}</td></tr>`).join("\n")}
</table>`
        : "";
      const shown = p.budgetYearItems.slice(0, MAX_ROWS);
      const more = p.budgetYearItems.length - shown.length;
      const items = shown.length
        ? `<p style="margin:12px 0 4px;${TEXT}">Due in ${year}:</p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${shown
  .map(
    (i) =>
      `<tr><td style="${CELL}">${escapeHtml(i.name)}${i.overdue ? `<br><span style="${MUTED}">Past its end of life</span>` : ""}</td><td style="${NUM}">${escapeHtml(costText(i.cost))}</td></tr>`,
  )
  .join("\n")}${more ? `\n<tr><td style="${CELL};color:#475569" colspan="2">+${more} more</td></tr>` : ""}
</table>`
        : "";
      const ahead = p.savingAhead.length ? `<p style="margin:8px 0 0;${MUTED}">${escapeHtml(savingAheadText(p))}</p>` : "";
      const left = p.leftOut.length
        ? `<p style="margin:8px 0 0;${TEXT}">${leftOutLead(p.leftOut)}: ${escapeHtml(p.leftOut.map((c) => leftOutLabel(c, year)).join(", "))}. <a style="${LINK}" href="${propertyUrl(p.propertyId)}">Fill ${plural(p.leftOut.length, "it", "them")} in</a>.</p>`
        : "";
      return `<p style="margin:20px 0 4px;font-size:15px;font-weight:600;color:#0f172a"><a style="${LINK}" href="${propertyUrl(p.propertyId)}">${escapeHtml(p.name)}</a></p>
${table}${items}${ahead}${left}`;
    })
    .join("\n");

  const html = page(
    subject,
    `<p style="margin:0 0 8px;${TEXT}">${escapeHtml(intro).replace("My properties", `<a style="${LINK}" href="${APP_URL}">My properties</a>`)}</p>
${propertyHtml}
<p style="margin:20px 0 0;${MUTED}">Costs are in today's dollars, from the components you saved. Anything past its end of life counts in ${year}.${reserveNote} Update conditions and install years in <a style="${LINK}" href="${updateUrl}">${escapeHtml(updateName)}</a> to keep these numbers right.</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    ...summary.properties.flatMap((p) => [
      "",
      `${p.name} (${propertyUrl(p.propertyId)})`,
      ...budgetRows(p, year).map(([label, value]) => `- ${label}: ${value}`),
      ...(p.budgetYearItems.length
        ? [
            `- Due in ${year}: ${p.budgetYearItems
              .slice(0, MAX_ROWS)
              .map((i) => `${i.name} ${costText(i.cost)}${i.overdue ? " (past its end of life)" : ""}`)
              .join(", ")}${p.budgetYearItems.length > MAX_ROWS ? `, +${p.budgetYearItems.length - MAX_ROWS} more` : ""}`,
          ]
        : []),
      ...(p.savingAhead.length ? [`- ${savingAheadText(p)}`] : []),
      ...(p.leftOut.length ? [`- ${leftOutLead(p.leftOut)}: ${p.leftOut.map((c) => leftOutLabel(c, year)).join(", ")}.`] : []),
    ]),
    "",
    `Costs are in today's dollars, from the components you saved. Anything past its end of life counts in ${year}.${reserveNote}`,
    `Update conditions and install years in ${updateName}: ${updateUrl}`,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}

/** One property's line in the condition report email. */
export interface ReportSummaryLine {
  readonly propertyId: string;
  readonly name: string;
  /** Past end of life or due within 2 years, left-out rows included. */
  readonly atRisk: number;
  readonly unrated: number;
  /** Components not in the report (no cost or no install year). */
  readonly leftOut: readonly LeftOutComponent[];
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
    [`${l.atRisk} at risk`, ...(l.unrated ? [`${l.unrated} without a condition rating`] : [])].join(", ");
  const left = (l: ReportSummaryLine) =>
    l.leftOut.length ? `Not in the report: ${l.leftOut.map((c) => leftOutLabel(c, year)).join(", ")}.` : "";
  const nudge =
    "The reports use the conditions and install years you saved. If something's changed, update it in My properties, and the next report (and your forecast) will reflect it.";
  // One property: the update link goes straight to it.
  const updateUrl = n === 1 ? propertyUrl(lines[0].propertyId) : APP_URL;
  const label = "A planning document made from the information you supplied, not an inspection.";

  const html = page(
    subject,
    `<p style="margin:0 0 12px;${TEXT}">${escapeHtml(intro)}</p>
<table role="presentation" style="width:100%;border-collapse:collapse">
${lines
  .map(
    (l) =>
      `<tr><td style="${CELL}"><a style="${LINK}" href="${propertyUrl(l.propertyId)}">${escapeHtml(l.name)}</a><br><span style="${MUTED}">${escapeHtml(detail(l))}</span>${
        l.leftOut.length
          ? `<br><span style="font-size:14px;color:#0f172a">${escapeHtml(left(l))} <a style="${LINK}" href="${propertyUrl(l.propertyId)}">Fill ${plural(l.leftOut.length, "it", "them")} in</a>.</span>`
          : ""
      }</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:16px 0 0;${TEXT}">${escapeHtml(nudge).replace("My properties", `<a style="${LINK}" href="${updateUrl}">My properties</a>`)}</p>
<p style="margin:8px 0 0;${MUTED}">${escapeHtml(label)}</p>`,
    footer,
  );

  const text = [
    subject,
    "",
    intro,
    "",
    ...lines.map((l) => `- ${l.name}: ${detail(l)} (${propertyUrl(l.propertyId)})${l.leftOut.length ? ` ${left(l)}` : ""}`),
    "",
    `${nudge} ${updateUrl}`,
    label,
    "",
    footerText(footer),
  ].join("\n");

  return { subject, html, text };
}
