"use client";

import dynamic from "next/dynamic";
import type { LibraryComponent } from "@/lib/library/components";

// The calculator reads localStorage and today's date, so it renders only in the browser.
const Calculator = dynamic(() => import("./Calculator"), {
  ssr: false,
  loading: () => (
    <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" aria-hidden="true" />
  ),
});

export default function CalculatorLoader({
  accountsEnabled,
  library,
}: {
  accountsEnabled: boolean;
  library: LibraryComponent[];
}) {
  return <Calculator accountsEnabled={accountsEnabled} library={library} />;
}
