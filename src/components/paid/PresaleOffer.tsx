import Link from "next/link";
import {
  FOUNDING_PRICE_TEXT,
  FOUNDING_PROMISE_TEXT,
  OFFER_TEXT,
  REFUND_TEXT,
  SAMPLE_REPORT_PATH,
  type Offer,
} from "@/lib/paid-ideas";
import BuyNow from "./BuyNow";

const link = "underline underline-offset-2 hover:text-slate-900 dark:hover:text-white";

/**
 * What a paid idea's panel shows once its Stripe link is set, in place of the
 * "tell me first" form: what you get, the price, Buy now, and the terms.
 */
export default function PresaleOffer({ offer, link: buyLink }: { offer: Offer; link: string }) {
  const text = OFFER_TEXT[offer];
  return (
    <div className="mt-1 space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-300">{text.pitch}</p>
      {offer === "membership" ? (
        <p className="text-sm font-medium text-slate-900 dark:text-white">{FOUNDING_PRICE_TEXT}</p>
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300">
          It&apos;s a planning document, not an inspection.{" "}
          <a href={SAMPLE_REPORT_PATH} className={link}>
            See a sample report (PDF)
          </a>
          .
        </p>
      )}
      <BuyNow offer={offer} link={buyLink} />
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {REFUND_TEXT} {offer === "membership" && `${FOUNDING_PROMISE_TEXT} `}You pay on Stripe&apos;s secure page, and
        we never see your card number.{" "}
        <Link href="/terms" className={link}>
          Terms
        </Link>
        {" · "}
        <Link href="/pricing" className={link}>
          Pricing
        </Link>
      </p>
    </div>
  );
}
