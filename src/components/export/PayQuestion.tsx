"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { alreadyAsked, nextStep, PAY_ANSWERS, remember, versioned, waitsForAnswer, type PayAnswer } from "@/lib/export/pay-question";
import { FIRST_PICK_QUESTION, FIRST_PICKS, offerForIdea, type FirstPick } from "@/lib/paid-ideas";
import PaidIdeaButton, { PhotoOffer } from "@/components/paid/PaidIdeaButton";
import { usePaidIdeas } from "@/components/paid/PaidIdeas";
import { useSeenOnScreen } from "@/components/useSeenOnScreen";

// The founding membership as /pricing sells it, at its real price.
export const PAY_QUESTION =
  "Would you pay $12/month for an email before each replacement comes due, plus a yearly budget summary and a condition report for lenders and buyers?";

/**
 * A short pricing survey. It appears after the first export in a browser
 * and stays until answered or dismissed. Once at least half of it has been on
 * screen, it never comes back on a later visit, even if it was ignored. A Yes
 * or Maybe gets one more question: which paid idea they'd use first, and the
 * pick leads to that idea's panel (or the photo offer).
 */
export default function PayQuestion({
  trigger,
  onDismiss,
  onAskingChange,
}: {
  /** The export that just finished; null until there has been one. */
  trigger: "csv" | "pdf" | null;
  /** Called on dismiss, to put keyboard focus back where it was. */
  onDismiss?: () => void;
  /** Told when a question starts or stops waiting for an answer, so the page can quiet other prompts. */
  onAskingChange?: (asking: boolean) => void;
}) {
  const [askedBefore] = useState(() => alreadyAsked());
  const [answer, setAnswer] = useState<PayAnswer | "dismissed" | null>(null);
  const [pick, setPick] = useState<FirstPick | "skipped" | null>(null);
  const shown = useRef(false);
  // In state, not a ref, so the check for being on screen starts when the card appears.
  const [questionEl, setQuestionEl] = useState<HTMLDivElement | null>(null);
  const followUp = useRef<HTMLParagraphElement>(null);
  const thanks = useRef<HTMLParagraphElement>(null);
  const followUpId = useId();
  const open = trigger !== null && !askedBefore;
  const step = nextStep(answer, pick);
  const asksFirstPick = step === "first_pick";
  const thanked = step === "thanks";
  const asking = open && waitsForAnswer(step);

  useEffect(() => {
    if (!asking) return;
    onAskingChange?.(true);
    return () => onAskingChange?.(false);
  }, [asking, onAskingChange]);

  // Counted as shown only once it's been seen, not when it appears below the screen.
  const markShown = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    remember("shown");
    void track("pay_question_shown", versioned({ trigger: trigger ?? "" }));
  }, [trigger]);
  useSeenOnScreen(questionEl, open ? markShown : null);

  // A card that opens below the screen (a phone, after tapping Download) is scrolled
  // into view; focus stays on the download button.
  useEffect(() => {
    if (!questionEl) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    questionEl.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [questionEl]);

  // The buttons just pressed go away, so focus moves to what replaces them.
  useEffect(() => {
    if (asksFirstPick) followUp.current?.focus();
    else if (thanked) thanks.current?.focus();
  }, [asksFirstPick, thanked]);

  function choose(value: PayAnswer) {
    markShown();
    setAnswer(value);
    remember(value);
    void track("pay_question_answered", versioned({ answer: value.toLowerCase(), trigger: trigger ?? "" }));
  }

  function choosePick(value: FirstPick) {
    setPick(value);
    void track(
      "pay_question_first_pick",
      versioned({ pick: value, answer: answer === "Yes" || answer === "Maybe" ? answer.toLowerCase() : "" }),
    );
  }

  function dismiss() {
    markShown();
    setAnswer("dismissed");
    remember("dismissed");
    void track("pay_question_dismissed", versioned({ trigger: trigger ?? "" }));
    onDismiss?.();
  }

  const card = "mt-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800";
  // Questions stand out from the page around them, so they're seen right after a download.
  const askCard =
    "mt-4 rounded-2xl bg-white p-5 shadow-md ring-2 ring-amber-400 sm:p-6 dark:bg-slate-900 dark:ring-amber-500/70";
  const eyebrow = "text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400";
  const answerButton =
    "rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-amber-50 hover:ring-amber-400 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:ring-amber-500";

  return (
    <>
      {/* Always in the page, so screen readers announce the question when it appears. */}
      <div aria-live="polite">
        {open && step === "question" && (
          <div ref={setQuestionEl} className={askCard}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={eyebrow}>One quick question</p>
                <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{PAY_QUESTION}</p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss question"
                className="-m-1 p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAY_ANSWERS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => choose(a)}
                  className={answerButton}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Outside the live region: these get focus instead, so they're read once. */}
      {open && asksFirstPick && (
        <div className={askCard}>
          <p
            ref={followUp}
            id={followUpId}
            tabIndex={-1}
            className="text-base font-semibold text-slate-900 focus:outline-none dark:text-white"
          >
            {FIRST_PICK_QUESTION}
          </p>
          <div role="group" aria-labelledby={followUpId} className="mt-4 flex flex-wrap gap-2">
            {FIRST_PICKS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => choosePick(p.value)}
                className={answerButton}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPick("skipped")}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Skip
            </button>
          </div>
        </div>
      )}
      {open && thanked && (
        <div className={card}>
          <p ref={thanks} tabIndex={-1} className="text-sm text-slate-700 focus:outline-none dark:text-slate-200">
            Thanks, that helps us decide what to build next.
          </p>
          {pick !== null && pick !== "skipped" && <NextStep pick={pick} />}
        </div>
      )}
    </>
  );
}

/**
 * After a pick, the way on: the panel for reminders or the report (Buy now once
 * its Stripe link is set, the "tell me first" list until then), or the photo offer.
 * Nothing when the test buttons are off or the pick was "Something else".
 */
function NextStep({ pick }: { pick: FirstPick }) {
  const { enabled, where, offerLinks } = usePaidIdeas();
  if (!enabled || pick === "other") return null;
  if (pick === "photo") return <PhotoOffer where={where} className="mt-3" />;
  const offer = offerForIdea(pick);
  return (
    <>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
        {offer && offerLinks[offer] ? "You can get it now:" : "Get on the list for it:"}
      </p>
      <PaidIdeaButton idea={pick} className="mt-2" />
    </>
  );
}
