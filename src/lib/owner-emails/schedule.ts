// When each automatic email goes out. The sender runs once a day; these say which
// emails are open to send that day. The email log stops anything going twice, so a
// day that fails is caught up the next day.

/** The calendar day in Kevin's time zone (Central), which is what "early January" means. */
export const SEND_TIME_ZONE = "America/Chicago";

export interface LocalDate {
  readonly year: number;
  /** 1 to 12. */
  readonly month: number;
  readonly day: number;
}

export function localDate(now: Date, timeZone: string = SEND_TIME_ZONE): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, p) => (p.type === "literal" ? acc : { ...acc, [p.type]: Number(p.value) }), {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** Reminders: from January 2 for that year's replacements, then any day something new is due. */
export const REMINDERS_FROM_DAY = 2;

/** At most one reminder email per owner in this many days, so a week of edits is one email. */
export const REMINDER_GAP_DAYS = 7;

/** The condition report: second week of January, so it doesn't land with the January reminder. */
export const CONDITION_REPORT_MONTH = 1;
export const CONDITION_REPORT_FROM_DAY = 8;

/** The budget summary: from November 2, in time for next year's budget. */
export const BUDGET_SUMMARY_MONTH = 11;
export const BUDGET_SUMMARY_FROM_DAY = 2;

export interface OpenJobs {
  /** The year whose replacements a reminder covers, or null on January 1. */
  readonly reminderYear: number | null;
  /** The year the budget summary is for (next year), or null outside its window. */
  readonly budgetYear: number | null;
  /** The year the condition report is for, or null outside its window. */
  readonly reportYear: number | null;
}

export function openJobs(date: LocalDate): OpenJobs {
  return {
    reminderYear: date.month === 1 && date.day < REMINDERS_FROM_DAY ? null : date.year,
    budgetYear: date.month === BUDGET_SUMMARY_MONTH && date.day >= BUDGET_SUMMARY_FROM_DAY ? date.year + 1 : null,
    reportYear: date.month === CONDITION_REPORT_MONTH && date.day >= CONDITION_REPORT_FROM_DAY ? date.year : null,
  };
}

/** Every email at once, for a preview run: reminders and the report for this year, the budget for next. */
export function previewJobs(date: LocalDate): OpenJobs {
  return { reminderYear: date.year, budgetYear: date.year + 1, reportYear: date.year };
}

/** True when the last reminder is far enough back for another one. */
export function reminderGapPassed(lastSent: Date | null, now: Date): boolean {
  if (!lastSent) return true;
  // Six and a half days, so a daily run at about the same time each day isn't pushed to day 8.
  return now.getTime() - lastSent.getTime() >= (REMINDER_GAP_DAYS - 0.5) * 24 * 60 * 60 * 1000;
}
