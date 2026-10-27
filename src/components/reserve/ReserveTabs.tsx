"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { RESERVE_TABS, TAB_LABELS, tabAfterKey, tabFromSearch, tabHref, type ReserveTab } from "./tabs";

/**
 * Follows the tab in the address: on the first load, after a link to the page
 * (the header's drops ?tab), and on back and forward. Renders nothing. The page
 * is built ahead of time, so the address can only be read in the browser, which
 * is why this sits in its own Suspense boundary.
 */
function FollowAddress({ onTab }: { onTab: (tab: ReserveTab) => void }) {
  const params = useSearchParams();
  const tab = params ? tabFromSearch(params.toString()) : null;
  useEffect(() => {
    if (tab) onTab(tab);
  }, [tab, onTab]);
  return null;
}

/**
 * The quick estimate and the expense list as tabs. The chosen tab is kept in the
 * address (?tab=expenses), so a reload or a shared link opens it, and the tab
 * always follows the address. Both panels stay mounted, so switching back keeps
 * what was typed.
 */
export default function ReserveTabs({ panels }: { panels: Record<ReserveTab, ReactNode> }) {
  const baseId = useId();
  // The quick estimate until the address is read.
  const [tab, setTab] = useState<ReserveTab>("quick");
  const buttons = useRef<Partial<Record<ReserveTab, HTMLButtonElement | null>>>({});

  function choose(next: ReserveTab) {
    setTab(next);
    // Next.js picks this up, so FollowAddress sees the same tab.
    window.history.replaceState(null, "", tabHref(window.location, next));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = tabAfterKey(tab, event.key);
    if (!next) return;
    event.preventDefault();
    choose(next);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <Suspense fallback={null}>
        <FollowAddress onTab={setTab} />
      </Suspense>
      <div
        role="tablist"
        aria-label="Ways to work out your reserve"
        className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70"
      >
        {RESERVE_TABS.map((t) => {
          const selected = t === tab;
          return (
            <button
              key={t}
              ref={(el) => {
                buttons.current[t] = el;
              }}
              id={`${baseId}-${t}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${t}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(t)}
              onKeyDown={onKeyDown}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-800 ${
                selected
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>
      {RESERVE_TABS.map((t) => (
        <div
          key={t}
          id={`${baseId}-${t}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${t}-tab`}
          hidden={t !== tab}
          className="mt-4"
        >
          {panels[t]}
        </div>
      ))}
    </div>
  );
}
