import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CONTACT_EMAIL } from "@/lib/site";
import { turnstileSiteKey } from "@/lib/turnstile";

export const metadata: Metadata = {
  title: "Privacy | CapexClock",
  description:
    "What CapexClock collects, why, and who helps run the site: PostHog analytics, Supabase accounts, Netlify Forms and Stripe payments. We don't sell your data.",
  alternates: { canonical: "/privacy" },
};

// Keep this page in step with what the code does (src/lib/analytics.ts,
// netlify/edge-functions/posthog-relay.ts, src/lib/supabase, src/components/SignupForm.tsx, src/components/paid,
// src/lib/turnstile.ts, the Stripe links in src/lib/paid-ideas.ts) whenever those change.
const UPDATED = "October 3, 2026";

// The sign-in check is mentioned only on deploys that have it switched on.
const CAPTCHA_ON = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) !== null;

const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Privacy</h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
            What CapexClock collects, why, and who helps us run the site. Last updated {UPDATED}.
          </p>

          <Section title="The short version">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>We don&apos;t sell your data or share it with advertisers.</li>
              <li>The free calculators work without an account. What you enter stays in your browser unless you save it to an account.</li>
              <li>We use PostHog to see how the site is used. It never gets your email, your property names or addresses, or anything you type.</li>
              <li>Payments go through Stripe. We never see your card number.</li>
            </ul>
          </Section>

          <Section title="The free calculators">
            <p>
              The CapEx calculator keeps your work in your browser&apos;s local storage, so it&apos;s still there when you
              come back. It isn&apos;t sent to us. PDF, Excel and CSV exports are made in your browser too, and so is reading a
              spreadsheet you import: the file or pasted rows never leave your browser. We also remember in
              your browser whether you&apos;ve answered our short survey, so we don&apos;t ask twice. Clearing your
              browser data removes all of this.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              When you sign in, we store your email address and the properties you save: their names, unit counts, year
              built, and each component&apos;s details and costs. They are stored with Supabase, our database provider,
              and only your account can read or change them. Supabase also sends our sign-in emails. A cookie keeps you
              signed in on this browser until you sign out.
            </p>
            <p className="mt-3">
              If you&apos;re a founding member, we email you replacement reminders, a yearly budget summary and a yearly
              condition report, made from the properties you save. Resend, our email provider, delivers them and sees
              your email address and what each email says. We keep a record of which emails we sent you, so none goes
              twice. We don&apos;t track whether you open them or click their links. Turn each one off under Email
              settings in My properties, or with the Unsubscribe link in any of them.
            </p>
            {CAPTCHA_ON && (
              <p className="mt-3">
                The sign-in page uses Cloudflare Turnstile to check that you&apos;re a person, so bots can&apos;t send
                sign-in emails. Cloudflare sees your IP address and details about your browser to do this.
              </p>
            )}
          </Section>

          <Section title="The early access list and idea sign-ups">
            <p>
              If you join the early access list, Netlify, our web host, stores what you send through Netlify Forms: your
              email, how many units you own, how you plan for big replacements today and, if you answer it, what worries you most. We
              use it to contact you about CapexClock.
            </p>
            <p className="mt-3">
              Some buttons in the calculator are for ideas we haven&apos;t built yet. If you ask us to tell you first
              about one, Netlify Forms stores your email, how many units you own, which idea it was and which page you
              were on. We only use it to email you about that idea.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              If you buy a founding membership or a condition report, Stripe processes the payment on its own secure
              page, and we never see your card number. Stripe shows us your name, email, billing country and postal
              code, your card&apos;s brand and last four digits, what you bought, and whether it was paid or refunded.
              We use these to deliver your order, send your reminders and answer you. Stripe also emails your receipts
              and runs the page where members cancel, and it handles your card details under its own privacy policy.
            </p>
          </Section>

          <Section title="Files you email us">
            <p>
              You might email us a spreadsheet, a PDF export or photos, for example to ask for a report, to have rows
              filled in for you from a photo of a label, or to send a sample of how you track CapEx today. We read these
              files, and so does Anthropic&apos;s Claude, an AI assistant that helps us prepare reports, fill in rows and
              make sure our import can read sheets like yours. We delete them within 30 days of delivering what you asked
              for, or within 30 days of getting them if you sent a sample. To have them deleted sooner, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                {CONTACT_EMAIL}
              </a>
              . Please remove tenant names before you send a file.
            </p>
          </Section>

          <Section title="Analytics">
            <p>We use PostHog to learn how people use CapexClock so we can improve it. PostHog records:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>the pages you visit and the site that sent you,</li>
              <li>clicks, without the text of what you clicked,</li>
              <li>
                steps like starting the calculator, getting a forecast or a quick estimate (how many systems were
                ticked, not your numbers), creating an account, saving a property, exporting, importing a spreadsheet
                (how many rows, never what&apos;s in them), and coming back on a later day,
              </li>
              <li>
                your answers to our short survey (one question, and a second one if you answer Yes or Maybe), and which buttons for ideas we haven&apos;t built yet you saw,
                clicked or signed up for, but not the email or unit count you gave,
              </li>
              <li>clicks on Buy now and visits to a thank-you page after paying, with which offer it was and nothing else,</li>
              <li>on the early access form, your answers about units and how you track CapEx, but not your email,</li>
              <li>basic details such as your browser, screen size and rough location, which PostHog works out from your IP address.</li>
            </ul>
            <p className="mt-3">
              When you&apos;re signed in, these are linked to your account&apos;s random ID, never your email. PostHog
              keeps a random ID in a cookie and in your browser&apos;s local storage so it can tell visits apart. The
              cookie lasts one year. We also keep the date of your last visit in your browser to count return visits.
              We don&apos;t record your screen. If you block cookies, the site still works.
            </p>
            <p className="mt-3">
              Analytics go to PostHog through capexclock.com rather than straight to PostHog, so most tracker blockers
              don&apos;t stop them. On the way, we pass on only what PostHog needs and your IP address (for the rough
              location above). Apart from the random ID PostHog keeps in its cookie, your cookies for this site,
              including your sign-in, are never passed on.
            </p>
          </Section>

          <Section title="Who we share data with">
            <p>
              Only the services that run the site: Netlify (hosting, the early access list and idea sign-ups), Supabase
              (accounts, saved properties and sign-in emails), Resend (delivering our emails), PostHog (analytics), Stripe
              (payments),{" "}
              {CAPTCHA_ON && "Cloudflare (the check on the sign-in page), "}and Anthropic (reading files you email us).
              We don&apos;t sell your data, and we don&apos;t share it with advertisers.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              You can delete a saved property from your account at any time. To delete your account, your early access
              answers, your idea sign-ups or files you emailed us, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                {CONTACT_EMAIL}
              </a>
              . Records of payments stay with Stripe and in our accounts for as long as tax law requires.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                {CONTACT_EMAIL}
              </a>
              . If we change how we handle your data, we&apos;ll update this page and the date at the top.
            </p>
            <p className="mt-3">
              <Link href="/" className={link}>
                Back to CapexClock
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
