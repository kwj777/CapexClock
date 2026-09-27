"use client";

import dynamic from "next/dynamic";

// The calculator reads localStorage and today's date, so it renders only in the browser.
const Calculator = dynamic(() => import("./Calculator"), {
  ssr: false,
  loading: () => (
    <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" aria-hidden="true" />
  ),
});

export default function CalculatorLoader() {
  return <Calculator />;
}
