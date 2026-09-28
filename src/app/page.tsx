import type { Metadata } from "next";
import Link from "next/link";
import ForecastMockup from "@/components/ForecastMockup";
import SignupForm from "@/components/SignupForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { pageMetadata } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

const PROBLEMS = [
  {
    title: "Spreadsheets break as you add doors",
    body: "Every new building means another tab, another set of formulas, and another place for a stale install year to hide.",
  },
  {
    title: "Your PM software tracks rent, not roofs",
    body: "It knows who paid in March. It has no idea your boiler is 22 years old.",
  },
  {
    title: "You find out when a tenant calls",
    body: "Without a forecast, the first sign a system is dead is a no-heat call in January and a bill you didn't reserve for.",
  },
];

const STEPS = [
  {
    title: "Add your components",
    body: "List each building's roofs, HVAC, water heaters, and more, with the year each was installed.",
  },
  {
    title: "See what's due and when",
    body: "Get a rolling 10-year replacement forecast, year by year, with estimated costs.",
  },
  {
    title: "Know what to reserve",
    body: "Get one number: exactly how much to set aside per unit, per month.",
  },
];

const TOOLS = [
  {
    href: "/capex-calculator",
    title: "CapEx calculator",
    body: "List your building's components and install years. Get a 10-year replacement forecast and a monthly reserve per unit.",
  },
  {
    href: "/reserve-calculator",
    title: "Reserve calculator",
    body: "Already know what's coming up? Enter each expense and when it's due to see what to set aside each month.",
  },
  {
    href: "/lifespan",
    title: "Component lifespans",
    body: "How long roofs, furnaces, water heaters and 22 other components typically last, and the signs they're near the end.",
  },
];

const POPULAR_LIFESPANS = [
  { slug: "asphalt-shingle-roof", label: "roof" },
  { slug: "tank-water-heater", label: "water heater" },
  { slug: "gas-furnace", label: "furnace" },
  { slug: "central-ac", label: "central AC" },
  { slug: "boiler", label: "boiler" },
];

const FAQ = [
  { q: "Is it free?", a: "Yes, the core forecaster is free." },
  { q: "Who is it for?", a: "Owners of roughly 5–100 rental units." },
  { q: "Do I need to connect my accounting software?", a: "No." },
  {
    q: "Can I use it now?",
    a: "Yes. The calculator is open to everyone, and a free account saves your properties. Replacement reminders and a lender-ready condition report are coming next. Join the early access list to try them first.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/capex-calculator"
      className={`inline-flex items-center justify-center rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${className}`}
    >
      Try the free calculator
    </Link>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-950 dark:text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              Know when every system in your building runs out.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-slate-600 dark:text-slate-300">
              CapexClock turns your building&apos;s roofs, HVAC, and water heaters into a
              10-year replacement forecast and a monthly reserve number, so the next big
              expense isn&apos;t a surprise.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <CtaButton />
              <span className="text-sm text-slate-500 dark:text-slate-400">For owners of 5–100 units</span>
            </div>
          </div>
          <ForecastMockup />
        </section>

        {/* Problem */}
        <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              The big expenses are predictable. Most owners just aren&apos;t tracking them.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-xl bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{p.title}</h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 font-mono text-sm font-semibold text-white dark:bg-amber-500 dark:text-slate-950">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <CtaButton />
          </div>
        </section>

        {/* Free tools */}
        <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Free tools you can use today
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-600 dark:text-slate-300">No signup needed.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group rounded-xl bg-white p-6 ring-1 ring-slate-200 transition hover:ring-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-amber-500"
                >
                  <h3 className="font-semibold text-slate-950 group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-400">
                    {t.title} <span aria-hidden="true">→</span>
                  </h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{t.body}</p>
                </Link>
              ))}
            </div>
            <p className="mt-8 text-slate-600 dark:text-slate-400">
              Popular:{" "}
              {POPULAR_LIFESPANS.map((l, i) => (
                <span key={l.slug}>
                  {i > 0 && " · "}
                  <Link
                    href={`/lifespan/${l.slug}`}
                    className="font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
                  >
                    How long does a {l.label} last?
                  </Link>
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="scroll-mt-8 bg-slate-950 dark:border-y dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div className="text-white">
              <h2 className="text-3xl font-semibold tracking-tight">Get early access to what&apos;s next</h2>
              <p className="mt-4 max-w-md text-lg text-slate-300">
                The calculator is free to use today. Next we&apos;re building replacement reminders
                and a lender-ready condition report. Join the list to try them early. Your answers
                help us build the right thing first.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 sm:p-8 dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
              <SignupForm />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Frequently asked questions
          </h2>
          <dl className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="py-5">
                <dt className="font-semibold text-slate-950 dark:text-white">{q}</dt>
                <dd className="mt-1.5 text-slate-600 dark:text-slate-400">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
