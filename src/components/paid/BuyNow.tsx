"use client";

import { useEffect, useId, useRef, type MouseEvent } from "react";
import { track } from "@/lib/analytics";
import { buyNowClick, isTestLink, OFFER_TEXT, presaleEvent, type Offer } from "@/lib/paid-ideas";

/** How long Buy now waits for its click to be recorded before going to Stripe. */
const TRACK_WAIT_MS = 600;

/**
 * How long more clicks are ignored once the page is told to go to Stripe, so a
 * double click is one trip and one event. If the page stays (the property
 * editor's "leave page?" prompt was canceled), Buy now works again after this,
 * without counting again.
 */
const LEAVING_MS = 2000;

/**
 * Offers whose click was counted since this page was last shown. Going to
 * Stripe unloads the page and empties this; coming Back to a page the browser
 * kept empties it too. So each trip to Stripe is one event, even across the
 * panels and pages of one visit.
 */
const counted = new Set<Offer>();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A Buy now link to a Stripe Payment Link, with the price note right next to
 * it. It's a plain link, so it works before the page's script has loaded. It
 * sends presale_checkout_clicked first (once per trip to Stripe), waiting a
 * moment so the event isn't lost when the page changes.
 */
export default function BuyNow({ offer, link }: { offer: Offer; link: string }) {
  const noteId = `${useId()}-price`;
  const going = useRef(false);
  const { name, priceNote } = OFFER_TEXT[offer];

  // Back from Stripe, the browser may show this page as it was left. Let Buy now
  // work again, and count the next trip.
  useEffect(() => {
    const back = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      going.current = false;
      counted.clear();
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, []);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const newTab = event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const { step, send } = buyNowClick({ leaving: going.current, counted: counted.has(offer), newTab });
    if (step === "ignore") {
      event.preventDefault();
      return;
    }
    const sent = send ? track("presale_checkout_clicked", presaleEvent(offer), { sendNow: true }) : undefined;
    // Opening a new tab or window leaves this page here, so nothing needs to wait.
    if (step === "new-tab") return;
    event.preventDefault();
    going.current = true;
    counted.add(offer);
    void Promise.race([sent ?? Promise.resolve(), wait(TRACK_WAIT_MS)])
      .catch(() => {})
      .finally(() => {
        window.location.assign(link);
        window.setTimeout(() => {
          going.current = false;
        }, LEAVING_MS);
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
