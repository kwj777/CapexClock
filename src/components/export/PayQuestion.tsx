"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "capexclock:pay-question:v1";

export const PAY_QUESTION =
  "Would you pay $19/month for replacement reminders and a lender-ready condition report?";

const ANSWERS = ["Yes", "Maybe", "No"] as const;
type Answer = (typeof ANSWERS)[number];

function alreadyAsked(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function remember(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: the question may show again, which is fine.
  }
}

/**
 * One-question pricing survey. It appears after the first export in a browser
 * and stays until answered or dismissed, but never comes back on a later
 * visit, even if it was ignored.
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
  const [askedBefore] = useState(alreadyAsked);
  const [answer, setAnswer] = useState<Answer | "dismissed" | null>(null);
  const shown = useRef(false);
  const thanks = useRef<HTMLParagraphElement>(null);
  const open = trigger !== null && !askedBefore;

  useEffect(() => {
    if (!open || shown.current) return;
    shown.current = true;
    remember("shown");
    void track("pay_question_shown", { trigger });
  }, [open, trigger]);

  useEffect(() => {
    if (answer && answer !== "dismissed") thanks.current?.focus();
  }, [answer]);

  function choose(value: Answer) {
    setAnswer(value);
    remember(value);
    void track("pay_question_answered", { answer: value.toLowerCase(), trigger: trigger ?? "" });
  }

  function dismiss() {
    setAnswer("dismissed");
    remember("dismissed");
    void track("pay_question_dismissed", { trigger: trigger ?? "" });
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
            <div className="mt-3 flex gap-2">
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
      {/* Outside the live region: it gets focus instead, so it's read once. */}
      {open && answer !== null && answer !== "dismissed" && (
        <p ref={thanks} tabIndex={-1} className={`${card} text-sm text-slate-700 focus:outline-none dark:text-slate-200`}>
          Thanks, that helps us decide what to build next.
        </p>
      )}
    </>
  );
}
