"use client";

import { useState } from "react";
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

/** One-question pricing survey shown once per browser, after the first export. */
export default function PayQuestion({ trigger }: { trigger: "csv" | "pdf" }) {
  const [hidden] = useState(alreadyAsked);
  const [answer, setAnswer] = useState<Answer | "dismissed" | null>(null);
  if (hidden || answer === "dismissed") return null;

  function choose(value: Answer) {
    setAnswer(value);
    remember(value);
    void track("pay_question_answered", { answer: value.toLowerCase(), trigger });
  }

  function dismiss() {
    setAnswer("dismissed");
    remember("dismissed");
    void track("pay_question_dismissed", { trigger });
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      {answer ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">Thanks, that helps us decide what to build next.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{PAY_QUESTION}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss question"
              className="-m-1 p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              ✕
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
        </>
      )}
    </div>
  );
}
