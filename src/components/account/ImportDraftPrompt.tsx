"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadDraft, STORAGE_KEY } from "@/components/calculator/draft-storage";

// "Not now" is remembered for the calculator work as it was then, so the prompt
// comes back once that work changes.
const DISMISSED_KEY = "capexclock:import-prompt-dismissed:v1";
const DISMISSED_EVENT = "capexclock:import-prompt-dismissed";

// Follows the calculator in other tabs, so the prompt goes once that work is saved.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISSED_EVENT, onChange);
  };
}

/** Components in the calculator on this browser, or 0 when "Not now" was chosen for this work. */
function rowsToOffer(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null && window.localStorage.getItem(DISMISSED_KEY) === stored) return 0;
  } catch {
    // Storage blocked: loadDraft finds nothing either.
  }
  return loadDraft().rows.length;
}

function dismiss() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) window.localStorage.setItem(DISMISSED_KEY, stored);
  } catch {
    // Storage full or blocked: there is nowhere to remember it, so the prompt stays.
  }
  window.dispatchEvent(new Event(DISMISSED_EVENT));
}

/** Offers to save calculator work from this browser as a property. */
export default function ImportDraftPrompt() {
  const rows = useSyncExternalStore(subscribe, rowsToOffer, () => 0);
  if (rows === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        You have {rows} component{rows === 1 ? "" : "s"} in the calculator on this browser.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={dismiss}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Not now
        </button>
        <Link
          href="/app/properties/new?from=calculator"
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          Save it as a property
        </Link>
      </div>
    </div>
  );
}
