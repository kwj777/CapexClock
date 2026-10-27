"use client";

import { useEffect, useRef, useState } from "react";
import { IDEA_FOR_OFFER, type Offer } from "@/lib/paid-ideas";
import TellMeFirstForm from "./TellMeFirstForm";

/**
 * The "tell me first" list for an offer that isn't on sale, on /pricing. It
 * signs up for that offer's idea with `where` = "pricing", so the list shows
 * which offer each person wanted.
 */
export default function NotOnSaleForm({ offer }: { offer: Offer }) {
  const [signedUp, setSignedUp] = useState(false);
  const thanks = useRef<HTMLParagraphElement>(null);

  // The form goes away on success, so focus moves to the message.
  useEffect(() => {
    if (signedUp) thanks.current?.focus();
  }, [signedUp]);

  return (
    // ph-no-capture: PostHog's click capture skips the email box.
    <div className="ph-no-capture">
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {signedUp && (
          <p
            ref={thanks}
            tabIndex={-1}
            className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200 focus:outline-none dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
          >
            You&apos;re on the list. We&apos;ll email you when it&apos;s on sale.
          </p>
        )}
      </div>
      {!signedUp && (
        <TellMeFirstForm
          idea={IDEA_FOR_OFFER[offer]}
          where="pricing"
          defaultEmail=""
          stacked
          onSignedUp={() => setSignedUp(true)}
        />
      )}
    </div>
  );
}
