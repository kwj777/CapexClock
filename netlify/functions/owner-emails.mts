// Founding members' automatic emails: replacement reminders, the yearly budget
// summary and the yearly condition report. Netlify runs this once a day, on the live
// site only (never on deploy previews). What goes out when: src/lib/owner-emails/schedule.ts.
//
// Settings (Netlify > Site configuration > Environment variables; redeploy after changing):
//   OWNER_EMAILS_MODE    off (or unset): nothing. preview: every email for every member goes
//                        to support@capexclock.com, whatever the date. live: members get them.
//   RESEND_API_KEY       a Resend API key that can send from capexclock.com.
//   SUPABASE_SECRET_KEY  the sb_secret_ key. Server only: never in a NEXT_PUBLIC_ variable.
// To run it now: Netlify > Logs > Functions > owner-emails > Run now.

import type { Config } from "@netlify/functions";
import { conditionReportBuilder, siteFonts } from "../../src/lib/owner-emails/condition-report";
import { secretClient, supabaseStore } from "../../src/lib/owner-emails/db";
import { readMode, runOwnerEmails } from "../../src/lib/owner-emails/run";
import { resendSender } from "../../src/lib/owner-emails/send";
import { CONTACT_EMAIL, SITE_URL } from "../../src/lib/site";

// Scheduled functions stop after 30 seconds; members not reached are picked up the next day.
const TIME_BUDGET_MS = 20_000;

export default async function ownerEmails(): Promise<Response> {
  const mode = readMode(process.env.OWNER_EMAILS_MODE);
  if (mode === "off") {
    console.log("owner-emails: OWNER_EMAILS_MODE is off, nothing sent");
    return new Response(null, { status: 204 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !secret || !resendKey) {
    console.error("owner-emails: set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and RESEND_API_KEY");
    return new Response(null, { status: 500 });
  }

  const result = await runOwnerEmails({
    mode,
    now: new Date(),
    store: supabaseStore(secretClient(url, secret)),
    send: resendSender(resendKey),
    site: SITE_URL,
    previewTo: CONTACT_EMAIL,
    budgetMs: TIME_BUDGET_MS,
    // The report's font comes from the live site's public/fonts.
    conditionReport: conditionReportBuilder(siteFonts(SITE_URL)),
    pauseMs: 600,
  });
  // Counts and account ids only: no email addresses or property names in the logs.
  console.log(
    `owner-emails: mode=${result.mode} sent=${result.sent.length} failed=${result.failed.length} left=${result.leftForNextRun}`,
  );
  for (const f of result.failed) console.error(`owner-emails: ${f.userId} failed: ${f.error}`);
  return new Response(null, { status: result.failed.length ? 500 : 200 });
}

// 15:00 UTC is 9 AM Central in winter, 10 AM in summer.
export const config: Config = { schedule: "0 15 * * *" };
