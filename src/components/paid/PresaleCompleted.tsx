"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { firstCompletionThisVisit, presaleEvent, type Offer } from "@/lib/paid-ideas";

/**
 * Sends presale_completed once per visit from a thank-you page. Anyone can
 * open the page, so Stripe's list of payments is the real count.
 */
export default function PresaleCompleted({ offer }: { offer: Offer }) {
  useEffect(() => {
    if (firstCompletionThisVisit(offer, () => window.sessionStorage)) {
      void track("presale_completed", presaleEvent(offer));
    }
  }, [offer]);
  return null;
}
