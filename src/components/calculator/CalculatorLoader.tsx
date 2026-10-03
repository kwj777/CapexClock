"use client";

import dynamic from "next/dynamic";
import type { LibraryComponent, TypicalCost } from "@/verticals/landlord";
import { placeholderHeight, placeholderScript } from "./placeholder";
import { DRAFT_STORAGE_KEY } from "./storage-key";

/**
 * Holds the calculator's space while it loads: the empty calculator's height,
 * or taller when this browser has a saved draft, so the FAQ below doesn't jump.
 */
function CalculatorPlaceholder() {
  // On the server an inline script sizes it before first paint. If it's drawn
  // again in the browser, it reads the same draft to get the same height.
  const onServer = typeof window === "undefined";
  let height: number | null = null;
  if (!onServer) {
    try {
      height = placeholderHeight(window.localStorage.getItem(DRAFT_STORAGE_KEY), window.innerWidth);
    } catch {
      // Storage blocked: keep the empty calculator's height.
    }
  }
  return (
    <>
      <div
        className="h-[532px] animate-pulse rounded-2xl bg-slate-100 sm:h-[412px] lg:h-[392px] dark:bg-slate-900"
        style={height ? { height } : undefined}
        aria-hidden="true"
      />
      {onServer && <script dangerouslySetInnerHTML={{ __html: placeholderScript(DRAFT_STORAGE_KEY) }} />}
    </>
  );
}

// The calculator reads localStorage and today's date, so it renders only in the browser.
const Calculator = dynamic(() => import("./Calculator"), {
  ssr: false,
  loading: CalculatorPlaceholder,
});

export default function CalculatorLoader({
  accountsEnabled,
  library,
  typicalCosts,
}: {
  accountsEnabled: boolean;
  library: LibraryComponent[];
  typicalCosts: TypicalCost[];
}) {
  return <Calculator accountsEnabled={accountsEnabled} library={library} typicalCosts={typicalCosts} />;
}
