// The daily run behind netlify/functions/owner-emails.mts: for each founding member,
// send whichever emails are open today and not sent yet, then log them. Everything it
// touches outside (the database, Resend, the clock) is passed in, so tests run it whole.

import type { EmailLogRow, EmailSwitches } from "@/lib/supabase/database.types";
import {
  budgetSummary,
  reminderKey,
  remindersDue,
  type SavedProperty,
  type SavedReportComponent,
} from "@/verticals/landlord";
import { ONE_CLICK_PATH, unsubscribeUrl, type EmailKind } from "./kinds";
import { localDate, openJobs, previewJobs, reminderGapPassed, type OpenJobs } from "./schedule";
import type { Attachment, OutgoingEmail, SendEmail } from "./send";
import { budgetSummaryEmail, reminderEmail, type EmailContent, type EmailFooter } from "./templates";

/**
 * OWNER_EMAILS_MODE. "off" (or unset) sends nothing. "preview" sends every email that
 * exists for every member to the preview address, whatever the date, and logs nothing.
 * "live" sends to members on schedule and logs each email so it never goes twice.
 */
export type RunMode = "off" | "preview" | "live";

export function readMode(value: string | undefined): RunMode {
  const mode = value?.trim().toLowerCase();
  return mode === "live" || mode === "preview" ? mode : "off";
}

export interface Member {
  readonly userId: string;
  readonly email: string;
  readonly switches: EmailSwitches;
  readonly unsubscribeToken: string;
}

export interface OwnerData {
  readonly properties: readonly SavedProperty[];
  readonly components: readonly SavedReportComponent[];
}

export type LogEntry = Pick<EmailLogRow, "kind" | "year" | "component_id"> & { readonly sent_at?: string };

/** What the run reads and writes. db.ts is the real one, on Supabase. */
export interface EmailStore {
  /** Active members, each with an email address and a settings row (made if missing). */
  members(): Promise<Member[]>;
  ownerData(userId: string): Promise<OwnerData>;
  sentLog(userId: string): Promise<LogEntry[]>;
  record(userId: string, entries: readonly Omit<LogEntry, "sent_at">[]): Promise<void>;
}

/** The yearly condition report's email and PDFs for one owner, or null when there's nothing to report. */
export type ConditionReportBuilder = (
  data: OwnerData,
  year: number,
  footer: EmailFooter,
) => Promise<(EmailContent & { attachments: Attachment[] }) | null>;

export interface RunOptions {
  readonly mode: RunMode;
  readonly now: Date;
  readonly store: EmailStore;
  readonly send: SendEmail;
  /** The site the links point to. */
  readonly site: string;
  /** Where preview emails go. */
  readonly previewTo: string;
  /** Stop starting new members after this many ms; the next run picks up the rest. */
  readonly budgetMs?: number;
  /** Part 3. Without it the condition report isn't sent. */
  readonly conditionReport?: ConditionReportBuilder;
  /** Milliseconds since some fixed point, for the time budget. */
  readonly clock?: () => number;
  /** Wait this long before each send, to stay under Resend's rate limit (2 a second by default). */
  readonly pauseMs?: number;
}

export interface RunResult {
  readonly mode: RunMode;
  readonly sent: { readonly kind: EmailKind; readonly userId: string }[];
  readonly failed: { readonly userId: string; readonly error: string }[];
  /** Members not reached before the time ran out. */
  leftForNextRun: number;
}

const KIND_LOG: Record<EmailKind, EmailLogRow["kind"]> = {
  reminders: "reminder",
  budget_summary: "budget_summary",
  condition_report: "condition_report",
};

export async function runOwnerEmails(options: RunOptions): Promise<RunResult> {
  const { mode, now, store, site } = options;
  const result: RunResult = { mode, sent: [], failed: [], leftForNextRun: 0 };
  if (mode === "off") return result;

  const clock = options.clock ?? (() => Date.now());
  const started = clock();
  const date = localDate(now);
  const jobs = mode === "preview" ? previewJobs(date) : openJobs(date);
  const members = await store.members();

  for (let i = 0; i < members.length; i++) {
    if (options.budgetMs !== undefined && clock() - started > options.budgetMs) {
      result.leftForNextRun = members.length - i;
      break;
    }
    const member = members[i];
    try {
      await runMember(member, jobs, options, result, site);
    } catch (error) {
      result.failed.push({ userId: member.userId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

async function runMember(member: Member, jobs: OpenJobs, options: RunOptions, result: RunResult, site: string) {
  const { mode, store, now } = options;
  const live = mode === "live";
  const { switches } = member;
  const wantsAny =
    (switches.reminders && jobs.reminderYear !== null) ||
    (switches.budget_summary && jobs.budgetYear !== null) ||
    (switches.condition_report && jobs.reportYear !== null && options.conditionReport !== undefined);
  if (!wantsAny) return;

  const data = await store.ownerData(member.userId);
  if (data.properties.length === 0) return;
  const log = live ? await store.sentLog(member.userId) : [];
  const logged = (kind: EmailLogRow["kind"], year: number) => log.some((e) => e.kind === kind && e.year === year);

  const footer = (kind: EmailKind): EmailFooter => ({
    kind,
    unsubscribeUrl: unsubscribeUrl(site, member.unsubscribeToken, kind),
  });

  const deliver = async (kind: EmailKind, year: number, content: EmailContent, attachments?: Attachment[]) => {
    const email: OutgoingEmail = {
      ...content,
      subject: live ? content.subject : `[Preview for ${member.email}] ${content.subject}`,
      to: live ? member.email : options.previewTo,
      oneClickUrl: unsubscribeUrl(site, member.unsubscribeToken, kind, ONE_CLICK_PATH),
      attachments,
      idempotencyKey: live ? `${member.userId}:${KIND_LOG[kind]}:${year}:${now.toISOString().slice(0, 10)}` : undefined,
    };
    if (options.pauseMs) await new Promise((resolve) => setTimeout(resolve, options.pauseMs));
    await options.send(email);
    result.sent.push({ kind, userId: member.userId });
  };

  // Replacement reminders: what's due this year and not mentioned yet, at most once a week.
  if (switches.reminders && jobs.reminderYear !== null) {
    const year = jobs.reminderYear;
    const reminderLog = log.filter((e) => e.kind === "reminder");
    const last = reminderLog.reduce<Date | null>((latest, e) => {
      const at = e.sent_at ? new Date(e.sent_at) : null;
      return at && (!latest || at > latest) ? at : latest;
    }, null);
    if (!live || reminderGapPassed(last, now)) {
      const sent = new Set(reminderLog.map((e) => reminderKey(e.component_id ?? "", e.year)));
      const items = remindersDue(data.properties, data.components, year, sent);
      if (items.length > 0) {
        await deliver("reminders", year, reminderEmail(items, year, footer("reminders")));
        if (live) {
          await store.record(
            member.userId,
            items.map((item) => ({ kind: "reminder", year, component_id: item.componentId })),
          );
        }
      }
    }
  }

  // The yearly budget summary, for next year.
  if (switches.budget_summary && jobs.budgetYear !== null && !logged("budget_summary", jobs.budgetYear)) {
    const year = jobs.budgetYear;
    const summary = budgetSummary(data.properties, data.components, year);
    await deliver("budget_summary", year, budgetSummaryEmail(summary, footer("budget_summary")));
    if (live) await store.record(member.userId, [{ kind: "budget_summary", year, component_id: null }]);
  }

  // The yearly condition report, with a PDF per property.
  if (
    options.conditionReport &&
    switches.condition_report &&
    jobs.reportYear !== null &&
    !logged("condition_report", jobs.reportYear)
  ) {
    const year = jobs.reportYear;
    const report = await options.conditionReport(data, year, footer("condition_report"));
    if (report) {
      const { attachments, ...content } = report;
      await deliver("condition_report", year, content, attachments);
      if (live) await store.record(member.userId, [{ kind: "condition_report", year, component_id: null }]);
    }
  }
}
