import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import PresaleCompleted from "@/components/paid/PresaleCompleted";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import {
  FOUNDING_PROMISE_TEXT,
  isOffer,
  MEMBERSHIP_RENEWS_TEXT,
  OFFER_TEXT,
  OFFERS,
  presaleLinksFromEnv,
  REFUND_TEXT,
  REPORT_LABEL,
  SAMPLE_REPORT_PATH,
  type Offer,
} from "@/lib/paid-ideas";
import { CONTACT_EMAIL } from "@/lib/site";

// Where Stripe sends buyers after paying (each Payment Link's success URL).
// Hidden from search and left out of the sitemap.

export const dynamicParams = false;

export function generateStaticParams() {
  return OFFERS.map((offer) => ({ offer }));
}

const TITLES: Record<Offer, string> = {
  membership: "Thanks for becoming a founding member",
  report: "Thanks for ordering a condition report",
};

const EMAIL_SUBJECTS: Record<Offer, string> = {
  membership: "Founding membership: my building's components",
  report: "Condition report: my building's details",
};

// Baked in at build time. The membership is only on sale with it, but if it's
// taken out later, members can still cancel by email.
const PORTAL = presaleLinksFromEnv().portal;

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

async function offerFrom(params: PageProps<"/thanks/[offer]">["params"]): Promise<Offer> {
  const { offer } = await params;
  if (!isOffer(offer)) notFound();
  return offer;
}

export async function generateMetadata({ params }: PageProps<"/thanks/[offer]">): Promise<Metadata> {
  const offer = await offerFrom(params);
  return { title: `${TITLES[offer]} | CapexClock`, robots: { index: false, follow: false } };
}

export default async function ThanksPage({ params }: PageProps<"/thanks/[offer]">) {
  const offer = await offerFrom(params);
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECTS[offer])}`;
  const sendDetails = (
    <>
      <a href={mailto} className={link}>
        Email {CONTACT_EMAIL}
      </a>{" "}
      with your spreadsheet, or with a PDF or CSV from the calculator: under your forecast, click Download PDF or
      Download CSV and attach the file. Please remove tenant names first.
    </>
  );

  return (
    <>
      <PresaleCompleted offer={offer} />
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            {TITLES[offer]}
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            Your payment went through, and Stripe is emailing you a receipt.
          </p>

          <Section title="What happens next">
            <ol className="list-decimal space-y-3 pl-5">
              {offer === "membership" ? (
                <>
                  <li>
                    Within 2 business days, we email you from {CONTACT_EMAIL} to set up your reminders.
                  </li>
                  <li>
                    <strong className="font-semibold text-slate-950 dark:text-white">Send us your components.</strong>{" "}
                    {sendDetails} You can send them now, or reply to our email.
                  </li>
                  <li>
                    {OFFER_TEXT.membership.includes} {OFFER_TEXT.membership.delivery}
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong className="font-semibold text-slate-950 dark:text-white">Send us your building&apos;s details.</strong>{" "}
                    {sendDetails} If you know each item&apos;s condition (good, fair or poor), add it, with any notes.
                  </li>
                  <li>We make your report by hand and email it to you within 2 business days of getting your details.</li>
                  <li>
                    Share it with your lender or a buyer if you like. It&apos;s a planning document, not an inspection,
                    so they should get their own inspection too.
                  </li>
                </>
              )}
            </ol>
          </Section>

          {offer === "membership" ? (
            <Section title="Your membership">
              <p className="font-medium text-slate-950 dark:text-white">
                {PORTAL ? OFFER_TEXT.membership.priceNote : MEMBERSHIP_RENEWS_TEXT}
              </p>
              <p className="mt-3">
                {PORTAL ? (
                  <>
                    To cancel, or to change your card, use{" "}
                    <a href={PORTAL} className={link}>
                      Manage or cancel membership
                    </a>
                    . It&apos;s also at the bottom of every page.
                  </>
                ) : (
                  <>
                    To cancel, email{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                      {CONTACT_EMAIL}
                    </a>{" "}
                    and we&apos;ll cancel it.
                  </>
                )}
              </p>
              <p className="mt-3">
                {REFUND_TEXT} {FOUNDING_PROMISE_TEXT}
              </p>
            </Section>
          ) : (
            <Section title="Your report">
              <p>
                Its cover says: &ldquo;{REPORT_LABEL}&rdquo;{" "}
                <a href={SAMPLE_REPORT_PATH} className={link}>
                  See a sample report (PDF)
                </a>
                .
              </p>
              <p className="mt-3">{REFUND_TEXT}</p>
            </Section>
          )}

          <p className="mt-10 text-slate-600 dark:text-slate-300">
            Questions? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
            . See our{" "}
            <Link href="/terms" className={link}>
              terms
            </Link>
            .
          </p>
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
