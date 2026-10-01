"use client";

import { useId, useRef, type MouseEvent } from "react";
import { track } from "@/lib/analytics";
import { isTestLink, OFFER_TEXT, presaleEvent, type Offer } from "@/lib/paid-ideas";

/** How long Buy now waits for its click to be recorded before going to Stripe. */
const TRACK_WAIT_MS = 600;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A Buy now link to a Stripe Payment Link, with the price note right next to
 * it. It's a plain link, so it works before the page's script has loaded. It
 * sends presale_checkout_clicked first, waiting a moment so the event isn't
 * lost when the page changes.
 */
export default function BuyNow({ offer, link }: { offer: Offer; link: string }) {
  const noteId = `${useId()}-price`;
  const going = useRef(false);
  const { name, priceNote } = OFFER_TEXT[offer];

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (going.current) {
      event.preventDefault();
      return;
    }
    const sent = track("presale_checkout_clicked", presaleEvent(offer), { sendNow: true });
    // Opening a new tab or window leaves this page here, so nothing needs to wait.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    going.current = true;
    void Promise.race([sent, wait(TRACK_WAIT_MS)])
      .catch(() => {})
      .finally(() => {
        going.current = false;
        window.location.assign(link);
      });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={link}
          onClick={onClick}
          // Starts with the visible words, so "click Buy now" works by voice, and
          // says which offer, since a page can have two.
          aria-label={`Buy now: ${name}`}
          aria-describedby={noteId}
          className="inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          Buy now
        </a>
        <p id={noteId} className="text-sm font-medium text-slate-900 dark:text-white">
          {priceNote}
        </p>
      </div>
      {isTestLink(link) && (
        <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
          Stripe test mode: no real payment is taken.
        </p>
      )}
    </div>
  );
}
