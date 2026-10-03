// The three automatic emails founding members get, and the words for them in
// My properties and on the unsubscribe page. The sender (netlify/functions) uses the
// same keys, which are also the email_settings columns and email_unsubscribe's kinds.

import type { EmailSettingsRow, EmailSwitches } from "@/lib/supabase/database.types";

export const EMAIL_KINDS = ["reminders", "budget_summary", "condition_report"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** What an unsubscribe link can turn off: one email, or all three. */
export type UnsubscribeKind = EmailKind | "all";

export interface EmailKindText {
  /** The switch's label. */
  label: string;
  /** When it sends and what's in it, under the label. */
  when: string;
}

export const EMAIL_KIND_TEXT: Record<EmailKind, EmailKindText> = {
  reminders: {
    label: "Replacement reminders",
    when: "In early January, a list of what comes due that year. Anything you add later that's due goes out the next week.",
  },
  budget_summary: {
    label: "Yearly budget summary",
    when: "In early November: next year's replacements, the 10-year total and your monthly reserve, for each property.",
  },
  condition_report: {
    label: "Yearly condition report",
    when: "In early January: the condition report for each property, as a PDF.",
  },
};

/** No settings row yet means every email is on. */
export const DEFAULT_SWITCHES: EmailSwitches = { reminders: true, budget_summary: true, condition_report: true };

/** The switches from a settings row, or the defaults when there isn't one. */
export function switchesFrom(row: Pick<EmailSettingsRow, EmailKind> | null | undefined): EmailSwitches {
  if (!row) return { ...DEFAULT_SWITCHES };
  return { reminders: row.reminders, budget_summary: row.budget_summary, condition_report: row.condition_report };
}

export function isUnsubscribeKind(value: unknown): value is UnsubscribeKind {
  return value === "all" || (EMAIL_KINDS as readonly unknown[]).includes(value);
}

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An unsubscribe link's token and kind, from its query string, or null when either
 * is missing or malformed. A link with no kind turns off all three.
 */
export function readUnsubscribeLink(
  token: string | string[] | null | undefined,
  kind: string | string[] | null | undefined,
): { token: string; kind: UnsubscribeKind } | null {
  if (typeof token !== "string" || !TOKEN.test(token)) return null;
  if (kind === undefined || kind === null || kind === "") return { token: token.toLowerCase(), kind: "all" };
  if (!isUnsubscribeKind(kind)) return null;
  return { token: token.toLowerCase(), kind };
}

/** The page an unsubscribe link in an email opens. It asks before turning anything off. */
export const UNSUBSCRIBE_PATH = "/email/unsubscribe";

/**
 * Where mail apps send their one-click unsubscribe (the List-Unsubscribe header,
 * RFC 8058). A POST there turns the email off at once; a GET goes to the page.
 */
export const ONE_CLICK_PATH = "/email/unsubscribe/one-click";

/** An unsubscribe link for one email (or all three), on the given site. */
export function unsubscribeUrl(
  site: string,
  token: string,
  kind: UnsubscribeKind,
  path: typeof UNSUBSCRIBE_PATH | typeof ONE_CLICK_PATH = UNSUBSCRIBE_PATH,
): string {
  const url = new URL(path, site);
  url.searchParams.set("t", token);
  url.searchParams.set("k", kind);
  return url.toString();
}

/** What the unsubscribe page says once it's done. */
export function unsubscribedText(kind: UnsubscribeKind): string {
  if (kind === "all") return "You won't get any more automatic emails from CapexClock.";
  return `You won't get the ${EMAIL_KIND_TEXT[kind].label.toLowerCase()} email any more.`;
}
