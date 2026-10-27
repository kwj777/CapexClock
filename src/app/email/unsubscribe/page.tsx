import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { EMAIL_KIND_TEXT, readUnsubscribeLink } from "@/lib/owner-emails/kinds";
import { CONTACT_EMAIL } from "@/lib/site";
import UnsubscribeForm from "./UnsubscribeForm";

// The page the Unsubscribe link in every automatic email opens. It asks first, so a
// mail scanner that opens links can't unsubscribe anyone; mail apps' own one-click
// unsubscribe posts to ./one-click instead. Hidden from search, not in the sitemap.

export const metadata: Metadata = {
  title: "Unsubscribe | CapexClock",
  robots: { index: false, follow: false },
};

const heading = "text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white";
const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

export default async function UnsubscribePage({ searchParams }: PageProps<"/email/unsubscribe">) {
  const { t, k } = await searchParams;
  const parsed = readUnsubscribeLink(t, k);

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <article className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6">
          {parsed ? (
            <UnsubscribeForm
              token={parsed.token}
              kind={parsed.kind}
              heading={
                parsed.kind === "all"
                  ? "Unsubscribe from CapexClock emails?"
                  : `Unsubscribe from the ${EMAIL_KIND_TEXT[parsed.kind].label.toLowerCase()} email?`
              }
              intro={`${
                parsed.kind === "all"
                  ? "This turns off replacement reminders, the yearly budget summary and the yearly condition report."
                  : "Your other CapexClock emails stay on."
              } Sign-in links still arrive when you ask for one.`}
            />
          ) : (
            <>
              <h1 className={heading}>This unsubscribe link didn&apos;t work</h1>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                This link is incomplete. Turn emails off under Email settings in{" "}
                <Link href="/app" className={link}>
                  My properties
                </Link>
                , or email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                  {CONTACT_EMAIL}
                </a>{" "}
                and we&apos;ll do it for you.
              </p>
            </>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
