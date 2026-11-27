"use client";

import { useEffect } from "react";
import { CAME_FROM_KEY, cameFromVisit, chooseCameFrom, parseCameFrom } from "@/lib/came-from";

/**
 * Remembers, in this browser, which tagged link or website brought someone to
 * CapexClock (src/lib/came-from.ts explains). Shows nothing.
 */
export default function RememberCameFrom() {
  useEffect(() => {
    try {
      const now = Date.now();
      const visit = cameFromVisit(window.location.search, document.referrer, window.location.hostname, now);
      if (!visit) return;
      const kept = parseCameFrom(window.localStorage.getItem(CAME_FROM_KEY), now);
      const chosen = chooseCameFrom(kept, visit);
      if (chosen && chosen !== kept) window.localStorage.setItem(CAME_FROM_KEY, JSON.stringify(chosen));
    } catch {
      // Storage blocked: nothing is remembered, and the account still counts.
    }
  }, []);
  return null;
}
