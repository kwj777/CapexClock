import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import BuyNow from "@/components/paid/BuyNow";
import NotOnSaleForm from "@/components/paid/NotOnSaleForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { pageMetadata } from "@/lib/metadata";
import {
  FOUNDING_PRICE_TEXT,
  FOUNDING_PROMISE_TEXT,
  OFFER_TEXT,
  presaleLinksFromEnv,
  REFUND_TEXT,
  SAMPLE_REPORT_PATH,
  type Offer,
} from "@/lib/paid-ideas";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Pricing | CapexClock",
  description:
    "CapexClock is free today, with no limits during early access. A $12/month founding membership adds automatic reminders, and a $29 condition report is made by hand.",
  path: "/pricing",
});

// Baked in at build time. An offer without a link says it isn't on sale right now.
const LINKS = presaleLinksFromEnv();

// Plain text, so the FAQPage data below says exactly what the page shows.
const FAQ = [
  {
    q: "Is CapexClock free?",
    a: "Yes. It's free today, with no limits during early access: the calculators, saved properties, and PDF, Excel and CSV exports.",
  },
  {
    q: "What do founding members get?",
    a: `${OFFER_TEXT.membership.includes} ${OFFER_TEXT.membership.delivery} ${FOUNDING_PRICE_TEXT}`,
  },
  {
    q: "How do I cancel the membership?",
    // The membership is only on sale when the portal link is set (see presaleLinks).
    a: LINKS.portal
      ? "Any time online, with Manage or cancel membership at the bottom of every page. It stops renewing, and you aren't charged again."
      : `Once memberships go on sale, you'll be able to cancel any time online, or by emailing ${CONTACT_EMAIL}. It stops renewing, and you aren't charged again.`,
  },
  {
    q: "What's in the condition report?",
    a: `${OFFER_TEXT.report.includes} ${OFFER_TEXT.report.delivery} It's prepared from the information you give us. It's a planning document, not an inspection.`,
  },
  {
    q: "Can I share the report with my lender or a buyer?",
    a: "Yes, you can share it with anyone. No one but you may rely on it, though, and lenders and buyers should get their own inspection.",
  },
  {
    q: "What if it isn't right for me?",
    a: `Email ${CONTACT_EMAIL} within 30 days of a payment for a full refund. ${FOUNDING_PROMISE_TEXT}`,
  },
  {
    q: "Why only 20 of each?",
    a: "We make every report by hand and we're keeping the founding membership small while we decide what to build next, so we're taking up to 20 of each for now.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Pricing</h1>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-300">
            CapexClock is free today, with no limits during early access. We&apos;re also testing two paid extras
            while we decide what to build next.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <Plan name="Free" price="$0" summary="Free today, with no limits during early access.">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>The CapEx calculator, with a 10-year forecast and a monthly reserve</li>
                <li>The reserve calculator</li>
                <li>Lifespans for roofs, HVAC, water heaters and more</li>
                <li>A free account to save your properties</li>
                <li>PDF, Excel and CSV exports</li>
              </ul>
              <Link
                href="/capex-calculator"
                className="mt-6 inline-block rounded-md px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-white dark:ring-slate-700 dark:hover:bg-slate-800"
              >
                Open the free calculator
              </Link>
            </Plan>

            <Plan name={OFFER_TEXT.membership.name} price={OFFER_TEXT.membership.price} summary={FOUNDING_PRICE_TEXT}>
              <p>
                {OFFER_TEXT.membership.includes} {OFFER_TEXT.membership.delivery}
              </p>
              <Buy offer="membership" />
              <p className="mt-4 text-sm">
                {REFUND_TEXT} {FOUNDING_PROMISE_TEXT}
              </p>
            </Plan>

            <Plan
              name={OFFER_TEXT.report.name}
              price={OFFER_TEXT.report.price}
              summary="For lenders and buyers. A planning document, not an inspection."
            >
              <p>
                {OFFER_TEXT.report.includes} {OFFER_TEXT.report.delivery}
              </p>
              <p className="mt-3">
                <a href={SAMPLE_REPORT_PATH} className={link}>
                  See a sample report (PDF)
                </a>
              </p>
              <Buy offer="report" />
              <p className="mt-4 text-sm">{REFUND_TEXT}</p>
            </Plan>
          </div>

          <p className="mt-8 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            You pay on Stripe&apos;s secure page, and we never see your card number. Buying means you agree to our{" "}
            <Link href="/terms" className={link}>
              terms
            </Link>
            . Questions? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>

          <section className="mt-16 max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Questions</h2>
            <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {FAQ.map(({ q, a }) => (
                <div key={q} className="py-4">
                  <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                  <dd className="mt-1 text-slate-600 dark:text-slate-400">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Plan({ name, price, summary, children }: { name: string; price: string; summary: string; children: ReactNode }) {
  const id = `plan-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
    >
      <h2 id={id} className="text-lg font-semibold text-slate-950 dark:text-white">
        {name}
      </h2>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">{price}</p>
      <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{summary}</p>
      <div className="mt-4 text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}

/**
 * Buy now with the price note, or "not on sale right now" and that offer's
 * "tell me first" list while its link isn't set: before sales start, and after
 * it sells out or sales are paused.
 */
function Buy({ offer }: { offer: Offer }) {
  const buyLink = LINKS.offers[offer];
  if (buyLink) {
    return (
      <div className="mt-6">
        <BuyNow offer={offer} link={buyLink} />
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
      <p className="font-medium text-slate-900 dark:text-white">{OFFER_TEXT[offer].priceNote}</p>
      <p className="mt-1">Not on sale right now. Want to hear when it is?</p>
      <NotOnSaleForm offer={offer} />
    </div>
  );
}
