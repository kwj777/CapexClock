"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { CONTACT_EMAIL } from "@/lib/site";
import { SETUP_OFFER, setupOfferHref, type SetupOfferWhere } from "@/lib/setup-offer";

/** The done-for-you import offer, next to the import. */
export default function SetupOffer({ where, className = "" }: { where: SetupOfferWhere; className?: string }) {
  return (
    <aside
      aria-label="We can set up your buildings"
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-slate-300 ${className}`}
    >
      <p className="font-semibold text-slate-950 dark:text-white">{SETUP_OFFER.heading}</p>
      <p className="mt-1">
        {SETUP_OFFER.before}{" "}
        <a
          href={setupOfferHref(CONTACT_EMAIL)}
          // Opens the mail app and the page stays. The event goes at once: a phone
          // pauses the page while the mail app is open, which would hold it.
          onClick={() => void track("setup_offer_clicked", { where }, { sendNow: true })}
          className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        {SETUP_OFFER.after} We delete your file within 30 days of sending it back (see our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
          privacy page
        </Link>
        ).
      </p>
    </aside>
  );
}
