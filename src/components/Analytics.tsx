"use client";

import { useEffect } from "react";
import { countsThisBrowser, initAnalytics } from "@/lib/analytics";

export default function Analytics() {
  useEffect(() => {
    // ?count-me= is saved right away; only PostHog itself waits for a quiet moment.
    countsThisBrowser();
    const start = () => void initAnalytics();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
