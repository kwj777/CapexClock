"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { alreadyAsked, remember, versioned } from "@/lib/export/pay-question";
import { FIRST_PICK_QUESTION, FIRST_PICKS, type FirstPick } from "@/lib/paid-ideas";

export const PAY_QUESTION =
  "Would you pay $19/month for replacement reminders and a lender-ready condition report?";

const ANSWERS = ["Yes", "Maybe", "No"] as const;
type Answer = (typeof ANSWERS)[number];

/**
 * One-question pricing survey. It appears after the first export in a browser
 * and stays until answered or dismissed, but never comes back on a later
 * visit, even if it was ignored. A Yes or Maybe gets one more question: which
 * paid idea they'd use first.
 */
export default function PayQuestion({
  trigger,
  onDismiss,
}: {
  /** The export that just finished; null until there has been one. */
  trigger: "csv" | "pdf" | null;
  /** Called on dismiss, to put keyboard focus back where it was. */
  onDismiss?: () => void;
}) {
  const [askedBefore] = useState(() => alreadyAsked());
  const [answer, setAnswer] = useState<Answer | "dismissed" | null>(null);
  const [pick, setPick] = useState<FirstPick | "skipped" | null>(null);
  const shown = useRef(false);
  const followUp = useRef<HTMLParagraphElement>(null);
  const thanks = useRef<HTMLParagraphElement>(null);
  const followUpId = useId();
  const open = trigger !== null && !askedBefore;
  const asksFirstPick = (answer === "Yes" || answer === "Maybe") && pick === null;
  const thanked = answer === "No" || pick !== null;

  useEffect(() => {
    if (!open || shown.current) return;
    shown.current = true;
    remember("shown");
    void track("pay_question_shown", versioned({ trigger }));
  }, [open, trigger]);

  // The buttons just pressed go away, so focus moves to what replaces them.
  useEffect(() => {
    if (asksFirstPick) followUp.current?.focus();
    else if (thanked) thanks.current?.focus();
  }, [asksFirstPick, thanked]);

  function choose(value: Answer) {
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
    setAnswer("dismissed");
    remember("dismissed");
    void track("pay_question_dismissed", versioned({ trigger: trigger ?? "" }));
    onDismiss?.();
  }

  const card = "mt-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800";

  return (
    <>
      {/* Always in the page, so screen readers announce the question when it appears. */}
      <div aria-live="polite">
        {open && answer === null && (
          <div className={card}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{PAY_QUESTION}</p>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss question"
                className="-m-1 p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ANSWERS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => choose(a)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-amber-50 hover:ring-amber-400 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
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
        <div className={card}>
          <p
            ref={followUp}
            id={followUpId}
            tabIndex={-1}
            className="text-sm font-medium text-slate-900 focus:outline-none dark:text-white"
          >
            {FIRST_PICK_QUESTION}
          </p>
          <div role="group" aria-labelledby={followUpId} className="mt-3 flex flex-wrap gap-2">
            {FIRST_PICKS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => choosePick(p.value)}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-amber-50 hover:ring-amber-400 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700"
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
        <p ref={thanks} tabIndex={-1} className={`${card} text-sm text-slate-700 focus:outline-none dark:text-slate-200`}>
          Thanks, that helps us decide what to build next.
        </p>
      )}
    </>
  );
}
