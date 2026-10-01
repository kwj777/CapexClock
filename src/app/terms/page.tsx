import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import {
  FOUNDING_PRICE_TEXT,
  FOUNDING_PROMISE_TEXT,
  OFFER_TEXT,
  presaleLinksFromEnv,
  REPORT_LABEL,
  SAMPLE_REPORT_PATH,
} from "@/lib/paid-ideas";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms | CapexClock",
  description:
    "The terms for CapexClock's free tools, the $12/month founding membership and the $29 condition report: renewals, cancelling, refunds and what a report is.",
  alternates: { canonical: "/terms" },
};

// Plan T5 sets what this page must say. Keep it in step with /pricing, the
// panels (src/components/paid) and the thank-you pages.
const UPDATED = "October 1, 2026";

// Baked in at build time. Without it, members cancel by email.
const PORTAL = presaleLinksFromEnv().portal;

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
      {CONTACT_EMAIL}
    </a>
  );
}

export default function TermsPage() {
  const { membership, report } = OFFER_TEXT;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Terms</h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            The terms for CapexClock&apos;s free tools and the two things we sell while we test them. Last updated{" "}
            {UPDATED}.
          </p>

          <Section title="The short version">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>The calculators are free today, with no limits during early access.</li>
              <li>The founding membership is $12 every month until you cancel. Cancel any time online.</li>
              <li>The condition report is $29, paid once.</li>
              <li>Full refund within 30 days of any payment.</li>
              <li>A condition report is a planning document, not an inspection.</li>
            </ul>
          </Section>

          <Section title="The free tools">
            <p>
              The calculators, saved properties and PDF and CSV exports are free today, with no limits during early
              access. Their figures are estimates in today&apos;s dollars, worked out from the numbers you enter. They
              are for planning, and aren&apos;t professional, financial or engineering advice.
            </p>
            <p className="mt-3">
              If something in your building worries you, especially anything to do with gas, electrical, structure or
              safety, have a licensed professional look at it.
            </p>
          </Section>

          <Section title="Founding membership ($12/month)">
            <p>
              {membership.includes} {membership.delivery}
            </p>
            <p className="mt-3">{FOUNDING_PRICE_TEXT}</p>
            <p className="mt-3">
              It renews at $12 every month until you cancel. You can cancel any time online,{" "}
              {PORTAL ? (
                <>
                  through{" "}
                  <a href={PORTAL} className={link}>
                    Manage or cancel membership
                  </a>{" "}
                  (Stripe&apos;s customer portal, also linked at the bottom of every page), or by emailing <Email />.
                </>
              ) : (
                <>
                  by emailing <Email />.
                </>
              )}{" "}
              Once you cancel, it stops renewing and you aren&apos;t charged again. Your membership lasts until the end
              of the month you&apos;ve paid for.
            </p>
            <p className="mt-3">
              <strong className="font-semibold text-slate-950 dark:text-white">Our founding promise:</strong>{" "}
              {FOUNDING_PROMISE_TEXT}
            </p>
            <p className="mt-3">We&apos;re taking up to 20 founding members while we do this by hand.</p>
          </Section>

          <Section title="Condition report ($29)">
            <p>
              {report.includes} {report.delivery} You send us your building&apos;s details by email: a spreadsheet,
              or a PDF or CSV export from the calculator. Please remove tenant names first. We&apos;re taking up to 20
              orders while we make them by hand.{" "}
              <a href={SAMPLE_REPORT_PATH} className={link}>
                See a sample report (PDF)
              </a>
              .
            </p>
          </Section>

          <Section title="What a condition report is, and who can rely on it">
            <p>Every report carries this label on its cover:</p>
            <blockquote className="mt-3 border-l-4 border-amber-500 pl-4 font-medium text-slate-950 dark:text-white">
              {REPORT_LABEL}
            </blockquote>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>
                We don&apos;t visit or inspect your building. A report is only as accurate as the information you give
                us.
              </li>
              <li>
                You may share your report with anyone, such as a lender or a buyer. No one but you may rely on it, and
                buyers and lenders should get their own inspection.
              </li>
              <li>
                Anything about safety goes to a licensed professional. A report never says a system is safe.
              </li>
            </ul>
          </Section>

          <Section title="Refunds">
            <p>
              If you&apos;re not happy, email <Email /> within 30 days of a payment and we&apos;ll refund that payment
              in full. The refund goes back to the card you paid with. And if we don&apos;t build reminders, we cancel
              every founding membership and refund every payment, however long ago it was made.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Stripe handles every payment, and we never see your card number. Prices are in US dollars, and any sales
              tax is shown at checkout. Stripe emails you a receipt for each payment. See our{" "}
              <Link href="/privacy" className={link}>
                privacy page
              </Link>{" "}
              for what Stripe shares with us.
            </p>
          </Section>

          <Section title="Limit of liability">
            <p>
              As far as the law allows, our total liability to you for anything to do with CapexClock, a membership or a
              report is limited to the amount you paid us for it.
            </p>
          </Section>

          <Section title="Changes and questions">
            <p>
              If we change these terms, we&apos;ll update this page and the date at the top. A change never raises the
              founding price for someone who is already a member. Questions? Email <Email />.
            </p>
            <p className="mt-3">
              <Link href="/pricing" className={link}>
                See pricing
              </Link>
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-3 text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}
