"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadDraft } from "@/components/calculator/draft";

function subscribe(): () => void {
  return () => {};
}

/** Offers to save calculator work from this browser as a property. */
export default function ImportDraftPrompt() {
  const rows = useSyncExternalStore(subscribe, () => loadDraft().rows.length, () => 0);
  if (rows === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        You have {rows} component{rows === 1 ? "" : "s"} in the calculator on this browser.
      </p>
      <Link
        href="/app/properties/new?from=calculator"
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
      >
        Save it as a property
      </Link>
    </div>
  );
}
